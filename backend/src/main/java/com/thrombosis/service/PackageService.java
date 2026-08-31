package com.thrombosis.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.thrombosis.common.BusinessException;
import com.thrombosis.common.ErrorCode;
import com.thrombosis.dto.PageResult;
import com.thrombosis.entity.Package;
import com.thrombosis.mapper.PackageMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PackageService {

    private final PackageMapper packageMapper;

    /**
     * 套餐列表：city / itemNames 过滤 + 排序 + 分页（全部在 SQL 层完成）
     * cities / items 为 JSON 列，用 JSON_CONTAINS / JSON_SEARCH 做语义匹配，
     * 排序与分页走数据库，避免全表加载进 JVM。
     */
    public PageResult<Package> list(int page, int pageSize, String city, List<String> itemNames, String sort) {
        // 分页参数归一化：page 从 1 起，pageSize 限制在 1..100，杜绝 0/负数/超大值引发的异常
        int pageNo = Math.max(1, page);
        int pageSizeN = Math.min(100, Math.max(1, pageSize));
        QueryWrapper<Package> qw = new QueryWrapper<>();
        qw.eq("status", "on");
        if (city != null && !city.isBlank()) {
            qw.apply("JSON_CONTAINS(cities, JSON_QUOTE({0}))", city);
        }
        if (itemNames != null && !itemNames.isEmpty()) {
            // 任一项目名命中即保留（与原内存 noneMatch/noneMatch 语义一致：存在一条 name 在集合内）
            qw.and(w -> {
                for (int i = 0; i < itemNames.size(); i++) {
                    String name = itemNames.get(i);
                    if (name == null || name.isBlank()) continue;
                    w.or(x -> x.apply("JSON_SEARCH(items, 'one', {0}, NULL, '$[*].name') IS NOT NULL", name));
                }
            });
        }
        if ("price_asc".equals(sort)) {
            qw.orderByAsc("price");
        } else if ("price_desc".equals(sort)) {
            qw.orderByDesc("price");
        } else if ("sales".equals(sort)) {
            qw.orderByDesc("sales_count");
        } else {
            qw.orderByDesc("created_at");
        }

        Page<Package> p = new Page<>(pageNo, pageSizeN);
        packageMapper.selectPage(p, qw);
        return PageResult.of(p.getRecords(), p.getTotal(), pageNo, pageSizeN);
    }

    public Package detail(Long id) {
        Package p = packageMapper.selectById(id);
        if (p == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "套餐不存在");
        }
        return p;
    }
}
