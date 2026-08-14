package com.thrombosis.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("dict_item")
public class DictItem {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String type;
    private String name;
    private Integer sort;
}
