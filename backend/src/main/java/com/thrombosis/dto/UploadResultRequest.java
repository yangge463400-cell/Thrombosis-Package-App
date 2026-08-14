package com.thrombosis.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

/** 医护上传/出具检测结果 */
@Data
public class UploadResultRequest {
    /** 核销码（与 orderId 二选一） */
    private String code;
    /** 订单 id（与 code 二选一） */
    private Long orderId;
    /** 指标列表 [{name,value,unit,range,abnormal}]，可选 */
    private List<Map<String, Object>> reportItems;
    /** 完整报告 URL（PDF/图片），可选 */
    private String reportUrl;
}
