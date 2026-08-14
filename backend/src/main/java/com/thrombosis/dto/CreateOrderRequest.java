package com.thrombosis.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateOrderRequest {
    @NotNull(message = "套餐不能为空")
    private Long packageId;

    /** 核销医院（下单时选择，核销码绑定该医院，仅该院医护可核销） */
    @NotNull(message = "请选择核销医院")
    private Long hospitalId;
}
