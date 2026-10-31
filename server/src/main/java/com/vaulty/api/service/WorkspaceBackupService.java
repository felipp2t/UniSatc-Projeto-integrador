package com.vaulty.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.entity.WorkspaceItemFile;
import com.vaulty.api.exception.StorageUnavailableException;
import com.vaulty.api.repository.WorkspaceItemFileRepository;
import com.vaulty.api.storage.ObjectStorage;
import java.io.IOException;
import java.io.OutputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

@Service
public class WorkspaceBackupService {
    private final WorkspaceService workspaceService;
    private final WorkspaceItemFileRepository fileRepository;
    private final ObjectProvider<ObjectStorage> storageProvider;
    private final MaintenanceGate gate;
    private final ObjectMapper objectMapper;
    private final Environment environment;

    public WorkspaceBackupService(WorkspaceService workspaceService, WorkspaceItemFileRepository fileRepository,
            ObjectProvider<ObjectStorage> storageProvider, MaintenanceGate gate, ObjectMapper objectMapper,
            Environment environment) {
        this.workspaceService = workspaceService;
        this.fileRepository = fileRepository;
        this.storageProvider = storageProvider;
        this.gate = gate;
        this.objectMapper = objectMapper;
        this.environment = environment;
    }

    public BackupFile create(UUID ownerId) {
        workspaceService.requireOwner(ownerId);
        MaintenanceGate.Lease lease = gate.startBackup();
        Path directory = null;
        try {
            directory = Files.createTempDirectory("vaulty-backup-");
            Path dump = directory.resolve("database.dump");
            Path errors = directory.resolve("pg_dump.log");
            runPgDump(dump, errors);
            Path zip = directory.resolve("backup.zip");
            List<WorkspaceItemFile> files = fileRepository.findAll();
            List<Map<String, Object>> inventory = new java.util.ArrayList<>();
            try (OutputStream output = Files.newOutputStream(zip); ZipOutputStream archive = new ZipOutputStream(output)) {
                addFile(archive, "database.dump", dump);
                ObjectStorage storage = storageProvider.getIfAvailable();
                if (storage == null && !files.isEmpty()) {
                    throw new StorageUnavailableException();
                }
                for (WorkspaceItemFile file : files) {
                    byte[] content = storage.get(file.getStorageKey());
                    String entry = "attachments/" + file.getItemId();
                    addBytes(archive, entry, content);
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", file.getItemId());
                    item.put("storageKey", file.getStorageKey());
                    item.put("path", entry);
                    item.put("sizeBytes", content.length);
                    item.put("sha256", sha256(content));
                    inventory.add(item);
                }
                Map<String, Object> manifest = new LinkedHashMap<>();
                manifest.put("formatVersion", 1);
                manifest.put("createdAt", Instant.now().toString());
                manifest.put("applicationVersion", WorkspaceBackupService.class.getPackage().getImplementationVersion() == null
                        ? "unknown" : WorkspaceBackupService.class.getPackage().getImplementationVersion());
                manifest.put("workspaceId", workspaceService.singletonId());
                manifest.put("database", Map.of("path", "database.dump", "sizeBytes", Files.size(dump),
                        "sha256", sha256(dump)));
                manifest.put("attachments", inventory);
                addBytes(archive, "manifest.json", objectMapper.writeValueAsBytes(manifest));
            }
            Files.deleteIfExists(dump);
            Files.deleteIfExists(errors);
            lease.close();
            return new BackupFile(directory, zip);
        } catch (Exception exception) {
            lease.close();
            deleteTree(directory);
            throw new BackupGenerationException(exception);
        }
    }

    private void runPgDump(Path dump, Path errors) throws IOException, InterruptedException {
        String jdbcUrl = environment.getProperty("spring.datasource.url");
        URI database = URI.create(jdbcUrl.substring("jdbc:".length()));
        String databaseName = database.getPath().substring(1);
        ProcessBuilder builder = new ProcessBuilder("pg_dump", "--format=custom", "--no-owner", "--file", dump.toString(),
                "--host", database.getHost(), "--port", Integer.toString(database.getPort() < 0 ? 5432 : database.getPort()),
                "--username", environment.getProperty("spring.datasource.username", ""), "--dbname", databaseName);
        builder.environment().put("PGPASSWORD", environment.getProperty("spring.datasource.password", ""));
        builder.redirectError(errors.toFile());
        Process process = builder.start();
        boolean interrupted = false;
        try {
            if (!process.waitFor(2, TimeUnit.MINUTES)) {
                process.destroyForcibly();
                interrupted = waitForTermination(process);
                throw new IOException("pg_dump excedeu o tempo limite");
            }
            if (process.exitValue() != 0) {
                throw new IOException("pg_dump falhou: " + Files.readString(errors));
            }
        } catch (InterruptedException exception) {
            interrupted = true;
            process.destroyForcibly();
            interrupted |= waitForTermination(process);
            throw new IOException("A geração do dump foi interrompida", exception);
        } finally {
            if (process.isAlive()) {
                process.destroyForcibly();
                interrupted |= waitForTermination(process);
            }
            if (interrupted) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private boolean waitForTermination(Process process) {
        boolean interrupted = false;
        while (process.isAlive()) {
            try {
                process.waitFor();
            } catch (InterruptedException exception) {
                interrupted = true;
                process.destroyForcibly();
            }
        }
        return interrupted;
    }

    private void addFile(ZipOutputStream archive, String name, Path path) throws IOException {
        archive.putNextEntry(new ZipEntry(name));
        Files.copy(path, archive);
        archive.closeEntry();
    }

    private void addBytes(ZipOutputStream archive, String name, byte[] bytes) throws IOException {
        archive.putNextEntry(new ZipEntry(name));
        archive.write(bytes);
        archive.closeEntry();
    }

    private String sha256(byte[] content) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
    }

    private String sha256(Path path) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (var input = Files.newInputStream(path)) {
            byte[] buffer = new byte[8192];
            for (int read; (read = input.read(buffer)) != -1;) digest.update(buffer, 0, read);
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private void deleteTree(Path directory) {
        if (directory == null) return;
        try (var paths = Files.walk(directory)) {
            paths.sorted(java.util.Comparator.reverseOrder()).forEach(path -> {
                try { Files.deleteIfExists(path); } catch (IOException ignored) { }
            });
        } catch (IOException ignored) { }
    }

    public static class BackupFile implements AutoCloseable {
        private final Path directory;
        private final Path file;

        BackupFile(Path directory, Path file) {
            this.directory = directory;
            this.file = file;
        }

        public Path path() { return file; }

        @Override
        public void close() {
            try (var paths = Files.walk(directory)) {
                paths.sorted(java.util.Comparator.reverseOrder()).forEach(path -> {
                    try { Files.deleteIfExists(path); } catch (IOException ignored) { }
                });
            } catch (IOException ignored) { }
        }
    }

    public static class BackupGenerationException extends RuntimeException {
        BackupGenerationException(Throwable cause) { super(cause); }
    }
}
