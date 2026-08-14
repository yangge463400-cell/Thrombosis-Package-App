package com.thrombosis.controller;

import com.thrombosis.common.Result;
import com.thrombosis.dto.PageResult;
import com.thrombosis.dto.UploadResultRequest;
import com.thrombosis.entity.TestResult;
import com.thrombosis.security.RequireRole;
import com.thrombosis.security.UserContext;
import com.thrombosis.service.ResultService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/results")
@RequiredArgsConstructor
public class ResultController {

    private final ResultService resultService;

    @GetMapping
    public Result<PageResult<TestResult>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        return Result.ok(resultService.list(UserContext.currentUserId(), page, pageSize));
    }

    @GetMapping("/{id}")
    public Result<Map<String, Object>> detail(@PathVariable Long id) {
        return Result.ok(resultService.detail(UserContext.currentUserId(), id));
    }

    /**
     * 医护出具检测结果（staff 专属，医院由医护账号决定）
     * 出具后订单置为已完成，并推送站内消息
     */
    @PostMapping("/upload")
    @RequireRole({"staff"})
    public Result<Void> upload(@Valid @RequestBody UploadResultRequest req) {
        Long hospitalId = UserContext.get() == null ? null : UserContext.get().getHospitalId();
        resultService.upload(hospitalId, UserContext.currentUserId(), req);
        return Result.ok();
    }
}
