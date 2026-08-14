package com.thrombosis.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.thrombosis.common.BusinessException;
import com.thrombosis.common.ErrorCode;
import com.thrombosis.dto.MedicationSaveRequest;
import com.thrombosis.entity.Medication;
import com.thrombosis.entity.MedicationRecord;
import com.thrombosis.mapper.MedicationMapper;
import com.thrombosis.mapper.MedicationRecordMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MedicationService {

    private final MedicationMapper medicationMapper;
    private final MedicationRecordMapper recordMapper;

    public List<Medication> list(Long userId) {
        return medicationMapper.selectList(new LambdaQueryWrapper<Medication>()
                .eq(Medication::getUserId, userId)
                .orderByDesc(Medication::getCreatedAt));
    }

    public Medication detail(Long userId, Long id) {
        return getOwned(userId, id);
    }

    public Medication create(Long userId, MedicationSaveRequest req) {
        Medication m = new Medication();
        m.setUserId(userId);
        apply(m, req);
        m.setStatus("active");
        m.setStartAt(LocalDate.now());
        m.setCreatedAt(LocalDateTime.now());
        medicationMapper.insert(m);
        return m;
    }

    public Medication update(Long userId, Long id, MedicationSaveRequest req) {
        Medication m = getOwned(userId, id);
        apply(m, req);
        medicationMapper.updateById(m);
        return m;
    }

    @Transactional
    public void delete(Long userId, Long id) {
        Medication m = getOwned(userId, id);
        medicationMapper.deleteById(m.getId());
        recordMapper.delete(new LambdaQueryWrapper<MedicationRecord>()
                .eq(MedicationRecord::getMedicationId, m.getId()));
    }

    /**
     * 打卡：标记某时间点已服用（当天）
     */
    public Map<String, Object> checkIn(Long userId, Long id, String timePointId) {
        Medication m = getOwned(userId, id);
        boolean valid = m.getTimePoints() != null && m.getTimePoints().stream()
                .anyMatch(tp -> timePointId.equals(String.valueOf(tp.get("id"))));
        if (!valid) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "时间点不存在");
        }
        LocalDate today = LocalDate.now();
        MedicationRecord exist = recordMapper.selectOne(new LambdaQueryWrapper<MedicationRecord>()
                .eq(MedicationRecord::getMedicationId, id)
                .eq(MedicationRecord::getTimePointId, timePointId)
                .eq(MedicationRecord::getRecordDate, today));
        if (exist == null) {
            exist = new MedicationRecord();
            exist.setMedicationId(id);
            exist.setTimePointId(timePointId);
            exist.setRecordDate(today);
            exist.setStatus("taken");
            recordMapper.insert(exist);
        } else {
            exist.setStatus("taken");
            recordMapper.updateById(exist);
        }
        Map<String, Object> r = new HashMap<>();
        r.put("medicationId", id);
        r.put("timePointId", timePointId);
        r.put("date", today.toString());
        r.put("status", "taken");
        return r;
    }

    /** 近 N 日打卡状态（用药详情用） */
    public List<MedicationRecord> records(Long userId, Long id, int days) {
        getOwned(userId, id);
        LocalDate from = LocalDate.now().minusDays(days - 1L);
        return recordMapper.selectList(new LambdaQueryWrapper<MedicationRecord>()
                .eq(MedicationRecord::getMedicationId, id)
                .ge(MedicationRecord::getRecordDate, from)
                .orderByDesc(MedicationRecord::getRecordDate));
    }

    private void apply(Medication m, MedicationSaveRequest req) {
        m.setDrugName(req.getDrugName());
        m.setDosePerTime(req.getDosePerTime());
        m.setTimesPerDay(req.getTimesPerDay());
        List<Map<String, Object>> timePoints = req.getTimePoints();
        timePoints.forEach(tp -> {
            if (!tp.containsKey("id")) {
                tp.put("id", UUID.randomUUID().toString().substring(0, 8));
            }
        });
        m.setTimePoints(timePoints);
        m.setReminderOn(req.getReminderOn() == null ? 1 : req.getReminderOn());
        m.setDoctorAssessed(m.getDoctorAssessed() == null ? "normal" : m.getDoctorAssessed());
    }

    private Medication getOwned(Long userId, Long id) {
        Medication m = medicationMapper.selectById(id);
        if (m == null || !m.getUserId().equals(userId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "用药方案不存在");
        }
        return m;
    }
}
