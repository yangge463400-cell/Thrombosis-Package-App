package com.thrombosis.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.thrombosis.common.Result;
import com.thrombosis.dto.PageResult;
import com.thrombosis.entity.DictItem;
import com.thrombosis.entity.Package;
import com.thrombosis.mapper.DictItemMapper;
import com.thrombosis.service.PackageService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class PackageController {

    private final PackageService packageService;
    private final DictItemMapper dictItemMapper;

    @GetMapping("/api/packages")
    public Result<PageResult<Package>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) List<String> itemIds,
            @RequestParam(required = false) String sort) {
        return Result.ok(packageService.list(page, pageSize, city, itemIds, sort));
    }

    @GetMapping("/api/packages/{id}")
    public Result<Package> detail(@PathVariable Long id) {
        return Result.ok(packageService.detail(id));
    }

    @GetMapping("/api/dicts/items")
    public Result<List<DictItem>> items() {
        return Result.ok(dictItemMapper.selectList(new LambdaQueryWrapper<DictItem>()
                .eq(DictItem::getType, "items").orderByAsc(DictItem::getSort)));
    }

    @GetMapping("/api/dicts/cities")
    public Result<List<DictItem>> cities() {
        return Result.ok(dictItemMapper.selectList(new LambdaQueryWrapper<DictItem>()
                .eq(DictItem::getType, "cities").orderByAsc(DictItem::getSort)));
    }
}
