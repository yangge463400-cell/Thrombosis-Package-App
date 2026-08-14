package com.thrombosis.controller;

import com.thrombosis.common.Result;
import com.thrombosis.dto.AdminLoginRequest;
import com.thrombosis.dto.PageResult;
import com.thrombosis.entity.Hospital;
import com.thrombosis.entity.Package;
import com.thrombosis.entity.PayBill;
import com.thrombosis.entity.VerifyRecord;
import com.thrombosis.security.RequireRole;
import com.thrombosis.security.UserContext;
import com.thrombosis.service.AdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    // ---------- 登录（公开） ----------
    @PostMapping("/login")
    public Result<Map<String, Object>> login(@Valid @RequestBody AdminLoginRequest req) {
        return Result.ok(adminService.login(req.getAccount(), req.getPassword()));
    }

    // ---------- 工作台统计 ----------
    @GetMapping("/statistics")
    @RequireRole({"admin", "hospital_admin"})
    public Result<Map<String, Object>> statistics() {
        var ctx = UserContext.get();
        return Result.ok(adminService.statistics(ctx.getRole(), ctx.getHospitalId()));
    }

    // ---------- 套餐管理（仅平台） ----------
    @GetMapping("/packages")
    @RequireRole({"admin"})
    public Result<PageResult<Package>> packages(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {
        return Result.ok(adminService.packages(page, pageSize, keyword, status));
    }

    @PostMapping("/packages")
    @RequireRole({"admin"})
    public Result<Package> createPackage(@RequestBody Package pkg) {
        return Result.ok(adminService.createPackage(pkg));
    }

    @PutMapping("/packages/{id}")
    @RequireRole({"admin"})
    public Result<Package> updatePackage(@PathVariable Long id, @RequestBody Package pkg) {
        return Result.ok(adminService.updatePackage(id, pkg));
    }

    @PutMapping("/packages/{id}/status")
    @RequireRole({"admin"})
    public Result<Void> toggleStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        adminService.togglePackageStatus(id, body.getOrDefault("status", "on"));
        return Result.ok();
    }

    // ---------- 核销记录（平台全量/医院本院） ----------
    @GetMapping("/verify-records")
    @RequireRole({"admin", "hospital_admin"})
    public Result<PageResult<VerifyRecord>> verifyRecords(
            @RequestParam(required = false) Long hospitalId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        var ctx = UserContext.get();
        return Result.ok(adminService.verifyRecords(ctx.getRole(), ctx.getHospitalId(), hospitalId,
                dateFrom, dateTo, status, page, pageSize));
    }

    // ---------- 售卖记录 ----------
    @GetMapping("/sales")
    @RequireRole({"admin", "hospital_admin"})
    public Result<PageResult<Map<String, Object>>> sales(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        var ctx = UserContext.get();
        return Result.ok(adminService.sales(ctx.getRole(), ctx.getHospitalId(), page, pageSize));
    }

    // ---------- 支付账单（仅平台） ----------
    @GetMapping("/bills")
    @RequireRole({"admin"})
    public Result<PageResult<PayBill>> bills(
            @RequestParam(required = false) String channel,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        return Result.ok(adminService.bills(channel, page, pageSize));
    }

    @PostMapping("/bills/{id}/sync")
    @RequireRole({"admin"})
    public Result<PayBill> syncBill(@PathVariable Long id) {
        return Result.ok(adminService.syncBill(id));
    }

    // ---------- 医院管理（仅平台） ----------
    @GetMapping("/hospitals")
    @RequireRole({"admin"})
    public Result<List<Hospital>> hospitals(@RequestParam(required = false) String keyword) {
        return Result.ok(adminService.hospitals(keyword));
    }

    @PostMapping("/hospitals")
    @RequireRole({"admin"})
    public Result<Hospital> createHospital(@RequestBody Hospital h) {
        return Result.ok(adminService.createHospital(h));
    }

    @PutMapping("/hospitals/{id}")
    @RequireRole({"admin"})
    public Result<Hospital> updateHospital(@PathVariable Long id, @RequestBody Hospital h) {
        return Result.ok(adminService.updateHospital(id, h));
    }

    @DeleteMapping("/hospitals/{id}")
    @RequireRole({"admin"})
    public Result<Void> deleteHospital(@PathVariable Long id) {
        adminService.deleteHospital(id);
        return Result.ok();
    }
}
