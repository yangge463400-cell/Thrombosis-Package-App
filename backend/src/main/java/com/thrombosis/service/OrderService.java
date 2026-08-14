package com.thrombosis.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.thrombosis.common.BusinessException;
import com.thrombosis.common.ErrorCode;
import com.thrombosis.dto.CreateOrderRequest;
import com.thrombosis.dto.OrderVO;
import com.thrombosis.dto.PageResult;
import com.thrombosis.entity.Hospital;
import com.thrombosis.entity.Orders;
import com.thrombosis.entity.Package;
import com.thrombosis.entity.PayBill;
import com.thrombosis.mapper.HospitalMapper;
import com.thrombosis.mapper.OrdersMapper;
import com.thrombosis.mapper.PackageMapper;
import com.thrombosis.mapper.PayBillMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrdersMapper ordersMapper;
    private final PackageMapper packageMapper;
    private final PayBillMapper payBillMapper;
    private final HospitalMapper hospitalMapper;
    private final MessageService messageService;
    private static final SecureRandom RANDOM = new SecureRandom();

    /** 创建订单（dev 下返回 mock 支付参数；生产由后端生成 wx.requestPayment 参数） */
    @Transactional
    public Map<String, Object> create(Long userId, CreateOrderRequest req) {
        Package pkg = packageMapper.selectById(req.getPackageId());
        if (pkg == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "套餐不存在");
        }
        if (!"on".equals(pkg.getStatus())) {
            throw new BusinessException(ErrorCode.ORDER_NOT_PAYABLE, "套餐已下架");
        }
        // 校验核销医院：必须存在且为合作中，且套餐覆盖该医院城市
        Hospital hospital = hospitalMapper.selectById(req.getHospitalId());
        if (hospital == null || !"cooperating".equals(hospital.getStatus())) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "所选医院不可用，请重新选择");
        }
        if (pkg.getCities() != null && !pkg.getCities().contains(hospital.getCity())) {
            throw new BusinessException(ErrorCode.SERVER_ERROR, "该套餐不在所选医院城市提供，请重新选择医院");
        }
        Orders o = new Orders();
        o.setOrderNo(genOrderNo());
        o.setUserId(userId);
        o.setPackageId(pkg.getId());
        o.setPackageName(pkg.getName());
        o.setAmount(pkg.getPrice());
        o.setPayAmount(pkg.getPrice());
        o.setStatus("pending_pay");
        o.setHospitalId(req.getHospitalId()); // 绑定核销医院，跨医院核销拦截依据
        o.setCreatedAt(LocalDateTime.now());
        ordersMapper.insert(o);

        Map<String, Object> payParams = new HashMap<>();
        payParams.put("timeStamp", String.valueOf(System.currentTimeMillis() / 1000));
        payParams.put("nonceStr", "mock" + RANDOM.nextInt(1000000));
        payParams.put("package", "prepay_id=mock" + o.getId());
        payParams.put("signType", "RSA");
        payParams.put("paySign", "mock-sign-" + RANDOM.nextInt(1000000));

        Map<String, Object> result = new HashMap<>();
        result.put("orderId", o.getId());
        result.put("orderNo", o.getOrderNo());
        result.put("payAmount", o.getPayAmount());
        result.put("payParams", payParams);
        return result;
    }

    public PageResult<OrderVO> list(Long userId, String status, int page, int pageSize) {
        LambdaQueryWrapper<Orders> qw = new LambdaQueryWrapper<Orders>()
                .eq(Orders::getUserId, userId)
                .orderByDesc(Orders::getCreatedAt);
        if (status != null && !status.isBlank() && !"all".equals(status)) {
            qw.eq(Orders::getStatus, status);
        }
        Page<Orders> p = new Page<>(page, pageSize);
        ordersMapper.selectPage(p, qw);
        return PageResult.of(p.getRecords().stream().map(this::toVO).toList(), p.getTotal(), page, pageSize);
    }

    public OrderVO detail(Long userId, Long orderId) {
        Orders o = getOwned(userId, orderId);
        return toVO(o);
    }

    @Transactional
    public void cancel(Long userId, Long orderId) {
        Orders o = getOwned(userId, orderId);
        if (!"pending_pay".equals(o.getStatus())) {
            throw new BusinessException(ErrorCode.ORDER_NOT_PAYABLE, "当前订单状态不可取消");
        }
        o.setStatus("cancelled");
        ordersMapper.updateById(o);
        messageService.send(userId, "order", "订单已取消",
                "您的订单 " + o.getOrderNo() + " 已取消，如已支付请联系客服处理退款。", "order", String.valueOf(o.getId()));
    }

    /**
     * 模拟微信支付回调（dev 专用，thrombosis.dev.mock.payment=true 时开放）
     * 置订单已支付、生成核销码、写支付账单、推送站内消息
     */
    @Transactional
    public Orders mockPayCallback(Long orderId) {
        Orders o = ordersMapper.selectById(orderId);
        if (o == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "订单不存在");
        }
        if (!"pending_pay".equals(o.getStatus())) {
            throw new BusinessException(ErrorCode.ORDER_NOT_PAYABLE, "订单不可支付，请刷新");
        }
        o.setStatus("paid");
        o.setPayChannel("wx");
        o.setPayTime(LocalDateTime.now());
        o.setVerifyCode(genVerifyCode());
        ordersMapper.updateById(o);

        PayBill bill = new PayBill();
        bill.setOrderId(o.getId());
        bill.setChannel("wx");
        bill.setTradeNo("MOCKWX" + System.currentTimeMillis());
        bill.setAmount(o.getPayAmount() == null ? o.getAmount() : o.getPayAmount());
        bill.setStatus("success");
        bill.setPaidAt(o.getPayTime());
        bill.setSyncAt(LocalDateTime.now());
        bill.setReconcileStatus("ok");
        payBillMapper.insert(bill);

        // 销量 +1
        Package pkg = packageMapper.selectById(o.getPackageId());
        if (pkg != null) {
            pkg.setSalesCount((pkg.getSalesCount() == null ? 0 : pkg.getSalesCount()) + 1);
            packageMapper.updateById(pkg);
        }

        messageService.send(o.getUserId(), "order", "支付成功",
                "您的订单 " + o.getOrderNo() + " 已支付成功，核销码 " + o.getVerifyCode() + "，请到院出示。",
                "order", String.valueOf(o.getId()));
        return o;
    }

    private Orders getOwned(Long userId, Long orderId) {
        Orders o = ordersMapper.selectById(orderId);
        if (o == null || !o.getUserId().equals(userId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "订单不存在");
        }
        return o;
    }

    public OrderVO toVO(Orders o) {
        OrderVO vo = new OrderVO();
        vo.setId(o.getId());
        vo.setOrderNo(o.getOrderNo());
        vo.setPackageId(o.getPackageId());
        vo.setPackageName(o.getPackageName());
        vo.setAmount(o.getAmount());
        vo.setPayAmount(o.getPayAmount());
        vo.setStatus(o.getStatus());
        vo.setPayChannel(o.getPayChannel());
        vo.setPayTime(o.getPayTime());
        vo.setVerifyCode(o.getVerifyCode());
        vo.setHospitalId(o.getHospitalId());
        vo.setVerifyTime(o.getVerifyTime());
        vo.setCreatedAt(o.getCreatedAt());
        Package pkg = packageMapper.selectById(o.getPackageId());
        if (pkg != null) {
            vo.setCover(pkg.getCover());
        }
        if (o.getHospitalId() != null) {
            Hospital h = hospitalMapper.selectById(o.getHospitalId());
            if (h != null) vo.setHospitalName(h.getName());
        }
        return vo;
    }

    private String genOrderNo() {
        return "TH" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + String.format("%03d", RANDOM.nextInt(1000));
    }

    private String genVerifyCode() {
        String code;
        do {
            code = String.format("%06d", RANDOM.nextInt(1_000_000));
        } while (ordersMapper.selectCount(new LambdaQueryWrapper<Orders>().eq(Orders::getVerifyCode, code)) > 0);
        return code;
    }
}
