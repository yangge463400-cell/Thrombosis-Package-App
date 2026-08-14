package com.thrombosis.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.thrombosis.entity.Banner;
import com.thrombosis.entity.Orders;
import com.thrombosis.entity.Package;
import com.thrombosis.mapper.BannerMapper;
import com.thrombosis.mapper.OrdersMapper;
import com.thrombosis.mapper.PackageMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class HomeService {

    private final BannerMapper bannerMapper;
    private final PackageMapper packageMapper;
    private final OrdersMapper ordersMapper;
    private final MessageService messageService;
    private final OrderService orderService;

    /**
     * /api/home 聚合：banner + 入口角标 + 推荐套餐 + 进行中订单
     */
    public Map<String, Object> aggregate(Long userId) {
        List<Banner> banners = bannerMapper.selectList(new LambdaQueryWrapper<Banner>()
                .eq(Banner::getStatus, 1).orderByAsc(Banner::getSort));

        List<Package> recommend = packageMapper.selectList(new LambdaQueryWrapper<Package>()
                .eq(Package::getStatus, "on")
                .orderByDesc(Package::getSalesCount)
                .last("LIMIT 3"));

        Orders ongoing = null;
        if (userId != null) {
            ongoing = ordersMapper.selectOne(new LambdaQueryWrapper<Orders>()
                    .eq(Orders::getUserId, userId)
                    .in(Orders::getStatus, "pending_pay", "paid")
                    .orderByDesc(Orders::getCreatedAt)
                    .last("LIMIT 1"));
        }

        Map<String, Object> result = new HashMap<>();
        result.put("banners", banners);
        result.put("unreadCount", userId == null ? 0 : messageService.unreadCount(userId));
        result.put("recommendPackages", recommend);
        result.put("ongoingOrder", ongoing == null ? null : orderService.toVO(ongoing));
        return result;
    }
}
