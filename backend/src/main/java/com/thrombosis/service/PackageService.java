package com.thrombosis.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.thrombosis.common.BusinessException;
import com.thrombosis.common.ErrorCode;
import com.thrombosis.dto.PageResult;
import com.thrombosis.entity.Package;
import com.thrombosis.mapper.PackageMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PackageService {

    private final PackageMapper packageMapper;

    /**
     * 套餐列表：city / itemNames 过滤 + 排序 + 分页
     * itemNames 为检测项目名称（套餐 items JSON 以 name 字段关联，无独立 id）
     */
    public PageResult<Package> list(int page, int pageSize, String city, List<String> itemNames, String sort) {
        List<Package> all = packageMapper.selectList(
                new LambdaQueryWrapper<Package>().eq(Package::getStatus, "on"));
        List<Package> filtered = new ArrayList<>(all);

        if (city != null && !city.isBlank()) {
            filtered.removeIf(p -> p.getCities() == null || p.getCities().stream().noneMatch(c -> c.equals(city)));
        }
        if (itemNames != null && !itemNames.isEmpty()) {
            filtered.removeIf(p -> p.getItems() == null
                    || p.getItems().stream().noneMatch(it -> itemNames.contains(String.valueOf(it.get("name")))));
        }

        if ("price_asc".equals(sort)) {
            filtered.sort(Comparator.comparing(Package::getPrice));
        } else if ("price_desc".equals(sort)) {
            filtered.sort(Comparator.comparing(Package::getPrice).reversed());
        } else if ("sales".equals(sort)) {
            filtered.sort(Comparator.comparing(Package::getSalesCount, Comparator.nullsLast(Comparator.reverseOrder())));
        } else {
            filtered.sort(Comparator.comparing(Package::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        }

        int total = filtered.size();
        int from = Math.min((page - 1) * pageSize, total);
        int to = Math.min(from + pageSize, total);
        return PageResult.of(filtered.subList(from, to), total, page, pageSize);
    }

    public Package detail(Long id) {
        Package p = packageMapper.selectById(id);
        if (p == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "套餐不存在");
        }
        return p;
    }
}
