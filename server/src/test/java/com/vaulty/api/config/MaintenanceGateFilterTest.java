package com.vaulty.api.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.vaulty.api.service.MaintenanceGate;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class MaintenanceGateFilterTest {

    @Test
    void backupRouteWithContextPathDoesNotAcquireWriterButSimilarRoutesAreBlocked() throws Exception {
        MaintenanceGate gate = new MaintenanceGate();
        MaintenanceGateFilter filter = new MaintenanceGateFilter(gate);
        try (MaintenanceGate.Lease ignored = gate.startBackup()) {
            MockHttpServletRequest backup = new MockHttpServletRequest("POST", "/vaulty/workspaces/backup");
            backup.setContextPath("/vaulty");
            backup.setServletPath("/workspaces/backup");
            MockFilterChain backupChain = new MockFilterChain();
            filter.doFilter(backup, new MockHttpServletResponse(), backupChain);
            assertThat(backupChain.getRequest()).isSameAs(backup);

            for (String path : new String[] {"/workspaces/backup/", "/workspaces/backup-alias"}) {
                MockHttpServletRequest alias = new MockHttpServletRequest("POST", "/vaulty" + path);
                alias.setContextPath("/vaulty");
                alias.setServletPath(path);
                MockHttpServletResponse response = new MockHttpServletResponse();
                MockFilterChain chain = new MockFilterChain();
                filter.doFilter(alias, response, chain);
                assertThat(response.getStatus()).isEqualTo(409);
                assertThat(chain.getRequest()).isNull();
            }
        }
    }

    @Test
    void backupLeavesQueriesAvailableAndRejectsNewMutations() throws Exception {
        MaintenanceGate gate = new MaintenanceGate();
        MaintenanceGateFilter filter = new MaintenanceGateFilter(gate);
        try (MaintenanceGate.Lease ignored = gate.startBackup()) {
            MockHttpServletRequest get = new MockHttpServletRequest("GET", "/workspaces");
            MockHttpServletResponse getResponse = new MockHttpServletResponse();
            MockFilterChain getChain = new MockFilterChain();
            filter.doFilter(get, getResponse, getChain);
            assertThat(getChain.getRequest()).isSameAs(get);
            assertThat(getResponse.getStatus()).isEqualTo(200);

            MockHttpServletRequest post = new MockHttpServletRequest("POST", "/workspaces/items");
            MockHttpServletResponse postResponse = new MockHttpServletResponse();
            MockFilterChain postChain = new MockFilterChain();
            filter.doFilter(post, postResponse, postChain);
            assertThat(postResponse.getStatus()).isEqualTo(409);
            assertThat(postChain.getRequest()).isNull();
        }
    }
}
