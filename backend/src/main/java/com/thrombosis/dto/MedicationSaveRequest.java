package com.thrombosis.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Data
public class MedicationSaveRequest {
    @NotBlank(message = "药物名称不能为空")
    private String drugName;
    private String dosePerTime;
    @NotNull(message = "每日次数不能为空")
    private Integer timesPerDay;
    @NotNull(message = "服用时间点不能为空")
    private List<Map<String, Object>> timePoints;
    private Integer reminderOn;
    /** 疗程开始日期（不传默认当天） */
    private LocalDate startAt;
    /** 疗程结束日期（可选） */
    private LocalDate endAt;
    /** 医生评估血栓状态（如 normal / thrombosis） */
    private String doctorAssessed;
}
