package com.thrombosis.controller;

import com.thrombosis.common.Result;
import com.thrombosis.dto.MedicationRecordRequest;
import com.thrombosis.dto.MedicationSaveRequest;
import com.thrombosis.entity.Medication;
import com.thrombosis.entity.MedicationRecord;
import com.thrombosis.security.UserContext;
import com.thrombosis.service.MedicationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/medications")
@RequiredArgsConstructor
public class MedicationController {

    private final MedicationService medicationService;

    @GetMapping
    public Result<List<Medication>> list() {
        return Result.ok(medicationService.list(UserContext.currentUserId()));
    }

    @GetMapping("/{id}")
    public Result<Map<String, Object>> detail(@PathVariable Long id) {
        Medication m = medicationService.detail(UserContext.currentUserId(), id);
        List<MedicationRecord> records = medicationService.records(UserContext.currentUserId(), id, 7);
        return Result.ok(Map.of(
                "medication", m,
                "recentRecords", records
        ));
    }

    @PostMapping
    public Result<Medication> create(@Valid @RequestBody MedicationSaveRequest req) {
        return Result.ok(medicationService.create(UserContext.currentUserId(), req));
    }

    @PutMapping("/{id}")
    public Result<Medication> update(@PathVariable Long id, @Valid @RequestBody MedicationSaveRequest req) {
        return Result.ok(medicationService.update(UserContext.currentUserId(), id, req));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        medicationService.delete(UserContext.currentUserId(), id);
        return Result.ok();
    }

    @PostMapping("/{id}/records")
    public Result<Map<String, Object>> checkIn(@PathVariable Long id, @Valid @RequestBody MedicationRecordRequest req) {
        return Result.ok(medicationService.checkIn(UserContext.currentUserId(), id, req.getTimePointId()));
    }
}
