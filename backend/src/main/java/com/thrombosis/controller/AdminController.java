package com.thrombosis.controller;

import com.thrombosis.common.Result;
import com.thrombosis.dto.AccountVO;
import com.thrombosis.dto.AdminLoginRequest;
import com.thrombosis.dto.AdminUserSaveRequest;
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

    // ---------- 当前账号信息（顶部医院名动态展示） ----------
    @GetMapping("/me")
    @RequireRole({"admin", "hospital_admin"})
    public Result<Map<String, Object>> me() {
        var ctx = UserContext.get();
        return Result.ok(adminService.me(ctx.getRole(), ctx.getUserId(), ctx.getHospitalId()));
    }

    // ---------- 医护管理（医院端锁本院 / 平台端可全量） ----------
    @GetMapping("/staffs")
    @RequireRole({"admin", "hospital_admin"})
    public Result<PageResult<AccountVO>> staffs(
            @RequestParam(required = false) Long hospitalId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        var ctx = UserContext.get();
        return Result.ok(adminService.staffs(ctx.getRole(), hospitalId, keyword, page, pageSize));
    }

    @PostMapping("/staffs")
    @RequireRole({"admin", "hospital_admin"})
    public Result<AccountVO> createStaff(@Valid @RequestBody AdminUserSaveRequest req) {
        var ctx = UserContext.get();
        return Result.ok(adminService.createStaff(ctx.getRole(), req));
    }

    @PutMapping("/staffs/{id}")
    @RequireRole({"admin", "hospital_admin"})
    public Result<AccountVO> updateStaff(@PathVariable Long id,
                                                            @Valid @RequestBody AdminUserSaveRequest req) {
        var ctx = UserContext.get();
        return Result.ok(adminService.updateStaff(ctx.getRole(), id, req));
    }

    @DeleteMapping("/staffs/{id}")
    @RequireRole({"admin", "hospital_admin"})
    public Result<Void> deleteStaff(@PathVariable Long id) {
        var ctx = UserContext.get();
        adminService.deleteStaff(ctx.getRole(), id);
        return Result.ok();
    }

    @PostMapping("/staffs/{id}/reset-password")
    @RequireRole({"admin", "hospital_admin"})
    public Result<Void> resetStaffPassword(@PathVariable Long id, @RequestBody Map<String, String> body) {
        var ctx = UserContext.get();
        adminService.resetStaffPassword(ctx.getRole(), id, body.getOrDefault("password", ""));
        return Result.ok();
    }

    // ---------- 医院管理员管理（仅平台管理员） ----------
    @GetMapping("/hospital-admins")
    @RequireRole({"admin"})
    public Result<PageResult<AccountVO>> hospitalAdmins(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long hospitalId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        return Result.ok(adminService.hospitalAdmins(keyword, hospitalId, page, pageSize));
    }

    @PostMapping("/hospital-admins")
    @RequireRole({"admin"})
    public Result<AccountVO> createHospitalAdmin(@Valid @RequestBody AdminUserSaveRequest req) {
        return Result.ok(adminService.createHospitalAdmin(req));
    }

    @PutMapping("/hospital-admins/{id}")
    @RequireRole({"admin"})
    public Result<AccountVO> updateHospitalAdmin(@PathVariable Long id,
                                                                    @Valid @RequestBody AdminUserSaveRequest req) {
        return Result.ok(adminService.updateHospitalAdmin(id, req));
    }

    @DeleteMapping("/hospital-admins/{id}")
    @RequireRole({"admin"})
    public Result<Void> deleteHospitalAdmin(@PathVariable Long id) {
        adminService.deleteHospitalAdmin(id);
        return Result.ok();
    }

    @PostMapping("/hospital-admins/{id}/reset-password")
    @RequireRole({"admin"})
    public Result<Void> resetHospitalAdminPassword(@PathVariable Long id, @RequestBody Map<String, String> body) {
        adminService.resetHospitalAdminPassword(id, body.getOrDefault("password", ""));
        return Result.ok();
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
