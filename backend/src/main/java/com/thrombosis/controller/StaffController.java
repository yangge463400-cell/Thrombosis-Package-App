package com.thrombosis.controller;

import com.thrombosis.common.Result;
import com.thrombosis.dto.StaffLoginRequest;
import com.thrombosis.security.RequireRole;
import com.thrombosis.security.UserContext;
import com.thrombosis.service.StaffService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
public class StaffController {

    private final StaffService staffService;

    @PostMapping("/login")
    public Result<Map<String, Object>> login(@Valid @RequestBody StaffLoginRequest req) {
        return Result.ok(staffService.login(req.getPhone(), req.getPassword()));
    }

    @GetMapping("/statistics")
    @RequireRole({"staff"})
    public Result<Map<String, Object>> statistics() {
        Long hospitalId = UserContext.get() == null ? null : UserContext.get().getHospitalId();
        return Result.ok(staffService.statistics(hospitalId));
    }
}
