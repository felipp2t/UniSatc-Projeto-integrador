package com.vaulty.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vaulty.api.exception.ConflictException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class MaintenanceGateTest {

    @Test
    void backupRejectsConcurrentBackupAndNewForegroundWritersButKeepsQueriesOutOfGate() {
        MaintenanceGate gate = new MaintenanceGate();
        try (MaintenanceGate.Lease ignored = gate.startBackup()) {
            assertThatThrownBy(gate::startBackup).isInstanceOf(ConflictException.class);
            assertThatThrownBy(gate::enterWriter).isInstanceOf(ConflictException.class);
        }

        try (MaintenanceGate.Lease ignored = gate.enterWriter()) {
            assertThat(gate).isNotNull();
        }
    }

    @Test
    void backupWaitsForAdmittedWriterAndBackgroundWritersResumeAfterRelease() throws Exception {
        MaintenanceGate gate = new MaintenanceGate();
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch backgroundEntered = new CountDownLatch(1);
        CountDownLatch backupStarted = new CountDownLatch(1);
        MaintenanceGate.Lease writer = gate.enterWriter();

        try {
            Future<MaintenanceGate.Lease> backup = executor.submit(() -> {
                MaintenanceGate.Lease lease = gate.startBackup();
                backupStarted.countDown();
                return lease;
            });

            assertThat(backupStarted.await(100, TimeUnit.MILLISECONDS)).isFalse();
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(2);
            boolean paused = false;
            while (System.nanoTime() < deadline) {
                try (MaintenanceGate.Lease ignored = gate.enterWriter()) {
                    Thread.yield();
                } catch (ConflictException conflict) {
                    paused = true;
                    break;
                }
            }
            assertThat(paused).isTrue();
            assertThatThrownBy(gate::enterWriter).isInstanceOf(ConflictException.class);
            Future<?> background = executor.submit(() -> {
                try (MaintenanceGate.Lease ignored = gate.enterBackgroundWriter()) {
                    backgroundEntered.countDown();
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                }
            });
            writer.close();
            assertThat(backupStarted.await(2, TimeUnit.SECONDS)).isTrue();
            assertThat(backgroundEntered.getCount()).isEqualTo(1);
            backup.get().close();
            background.get(2, TimeUnit.SECONDS);
            assertThat(backgroundEntered.getCount()).isZero();
        } finally {
            writer.close();
            executor.shutdownNow();
        }
    }

    @Test
    void closingBackupLeaseReopensWritersAfterFailurePath() {
        MaintenanceGate gate = new MaintenanceGate();
        try (MaintenanceGate.Lease ignored = gate.startBackup()) {
            throw new ExpectedFailure();
        } catch (ExpectedFailure expected) {
            try (MaintenanceGate.Lease writer = gate.enterWriter()) {
                assertThat(writer).isNotNull();
            }
        }
    }

    private static class ExpectedFailure extends RuntimeException { }
}
