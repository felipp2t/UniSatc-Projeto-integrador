package com.vaulty.api.service;

import com.vaulty.api.exception.ConflictException;
import org.springframework.stereotype.Component;

@Component
public class MaintenanceGate {
    // ponytail: one installation-wide lock; use distributed coordination only if the app becomes multi-instance.
    private int writers;
    private boolean backup;

    public synchronized Lease enterWriter() {
        if (backup) {
            throw new ConflictException("Backup em andamento; tente novamente depois");
        }
        writers++;
        return this::leaveWriter;
    }

    public synchronized Lease enterBackgroundWriter() throws InterruptedException {
        while (backup) {
            wait();
        }
        writers++;
        return this::leaveWriter;
    }

    public synchronized Lease startBackup() {
        if (backup) {
            throw new ConflictException("Já existe um backup em andamento");
        }
        backup = true;
        boolean acquired = false;
        try {
            while (writers > 0) {
                wait();
            }
            acquired = true;
            return this::finishBackup;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrompido ao aguardar gravações", exception);
        } finally {
            if (!acquired) {
                backup = false;
                notifyAll();
            }
        }
    }

    private synchronized void leaveWriter() {
        writers--;
        notifyAll();
    }

    private synchronized void finishBackup() {
        backup = false;
        notifyAll();
    }

    @FunctionalInterface
    public interface Lease extends AutoCloseable {
        @Override
        void close();
    }
}
