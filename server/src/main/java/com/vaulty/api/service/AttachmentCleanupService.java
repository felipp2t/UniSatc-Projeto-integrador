package com.vaulty.api.service;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AttachmentCleanupService {
    private final JdbcTemplate jdbcTemplate;
    private final AttachmentStorage storage;

    public void enqueue(String key) {
        jdbcTemplate.update("INSERT INTO attachment_cleanup (storage_key) VALUES (?) ON CONFLICT DO NOTHING", key);
    }

    @Scheduled(fixedDelay = 60000)
    public void processDue() {
        List<String> keys = jdbcTemplate.queryForList("""
                SELECT storage_key FROM attachment_cleanup
                WHERE next_retry_at <= now() ORDER BY next_retry_at LIMIT 20
                """, String.class);
        for (String key : keys) {
            try {
                storage.delete(key);
                jdbcTemplate.update("DELETE FROM attachment_cleanup WHERE storage_key = ?", key);
            } catch (RuntimeException failure) {
                jdbcTemplate.update("""
                        UPDATE attachment_cleanup SET attempts = attempts + 1,
                        next_retry_at = now() + make_interval(secs => LEAST(3600, 60 * power(2, LEAST(attempts, 6))::integer))
                        WHERE storage_key = ?
                        """, key);
            }
        }
    }
}
