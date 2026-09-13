package com.rootly.api.config;

import java.time.Clock;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class RateLimitRegistry {

    static final int MAX_REQUESTS = 5;
    static final int MAX_ENTRIES = 10_000;
    static final long WINDOW_MILLIS = 60_000;
    static final long INACTIVITY_MILLIS = 120_000;

    private final Map<String, Entry> entries = new HashMap<>();
    private final Clock clock;

    public RateLimitRegistry(Clock clock) {
        this.clock = clock;
    }

    public synchronized boolean tryConsume(String key) {
        long now = clock.millis();
        Entry entry = entries.get(key);

        if (entry == null) {
            cleanup(now);
            if (entries.size() >= MAX_ENTRIES) {
                return false;
            }
            entries.put(key, new Entry(now));
            return true;
        }

        if (now - entry.windowStartedAt >= WINDOW_MILLIS) {
            entry.windowStartedAt = now;
            entry.consumed = 0;
        }

        entry.lastAccessAt = now;
        if (entry.consumed >= MAX_REQUESTS) {
            return false;
        }

        entry.consumed++;
        return true;
    }

    public synchronized void cleanupInactive() {
        cleanup(clock.millis());
    }

    synchronized int size() {
        return entries.size();
    }

    private void cleanup(long now) {
        Iterator<Entry> iterator = entries.values().iterator();
        while (iterator.hasNext()) {
            if (now - iterator.next().lastAccessAt >= INACTIVITY_MILLIS) {
                iterator.remove();
            }
        }
    }

    private static final class Entry {
        private long windowStartedAt;
        private long lastAccessAt;
        private int consumed = 1;

        private Entry(long now) {
            this.windowStartedAt = now;
            this.lastAccessAt = now;
        }
    }
}
