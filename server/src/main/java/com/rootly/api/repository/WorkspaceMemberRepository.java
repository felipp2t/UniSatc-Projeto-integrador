package com.rootly.api.repository;

import com.rootly.api.entity.WorkspaceMember;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceMemberRepository extends JpaRepository<WorkspaceMember, UUID> {}
