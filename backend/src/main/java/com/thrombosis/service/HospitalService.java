package com.thrombosis.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.thrombosis.dto.PageResult;
import com.thrombosis.entity.Hospital;
import com.thrombosis.mapper.HospitalMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class HospitalService {

    private final HospitalMapper hospitalMapper;

    public List<Hospital> list(String city, Double lat, Double lng) {
        LambdaQueryWrapper<Hospital> qw = new LambdaQueryWrapper<Hospital>()
                .eq(Hospital::getStatus, "cooperating")
                .orderByAsc(Hospital::getId);
        if (city != null && !city.isBlank()) {
            qw.eq(Hospital::getCity, city);
        }
        // TODO(可选): 传入 lat/lng 时按距离排序（Haversine）
        return hospitalMapper.selectList(qw);
    }
}
