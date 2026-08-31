package com.thrombosis.controller;

import com.thrombosis.common.Result;
import com.thrombosis.dto.PageResult;
import com.thrombosis.dto.VerifyCheckRequest;
import com.thrombosis.dto.VerifyConfirmRequest;
import com.thrombosis.entity.VerifyRecord;
import com.thrombosis.security.RequireRole;
import com.thrombosis.security.UserContext;
import com.thrombosis.service.VerifyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/verify")
@RequiredArgsConstructor
@RequireRole({"staff"})
public class VerifyController {

    private final VerifyService verifyService;

    @PostMapping("/check")
    public Result<Map<String, Object>> check(@Valid @RequestBody VerifyCheckRequest req) {
        // 医院强制使用医护账号所属医院（UserContext），与 confirm 一致的跨院拦截
        Long staffHospitalId = UserContext.get() == null ? null : UserContext.get().getHospitalId();
        return Result.ok(verifyService.check(req.getCode(), staffHospitalId));
    }

    @PostMapping("/confirm")
    public Result<Map<String, Object>> confirm(@Valid @RequestBody VerifyConfirmRequest req) {
        // 医院强制使用医护账号所属医院（UserContext），客户端无法指定，杜绝越权
        Long staffHospitalId = UserContext.get() == null ? null : UserContext.get().getHospitalId();
        return Result.ok(verifyService.confirm(req.getCode(), staffHospitalId, UserContext.currentUserId()));
    }

    @GetMapping("/records")
    public Result<PageResult<VerifyRecord>> records(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        Long hospitalId = UserContext.get() == null ? null : UserContext.get().getHospitalId();
        return Result.ok(verifyService.records(hospitalId, date, page, pageSize));
    }
}
