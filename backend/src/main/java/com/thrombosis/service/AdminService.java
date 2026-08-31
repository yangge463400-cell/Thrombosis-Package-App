package com.thrombosis.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.thrombosis.common.BusinessException;
import com.thrombosis.common.ErrorCode;
import com.thrombosis.dto.AccountVO;
import com.thrombosis.dto.AdminUserSaveRequest;
import com.thrombosis.dto.PageResult;
import com.thrombosis.entity.Hospital;
import com.thrombosis.entity.Orders;
import com.thrombosis.entity.Package;
import com.thrombosis.entity.PayBill;
import com.thrombosis.entity.User;
import com.thrombosis.entity.VerifyRecord;
import com.thrombosis.mapper.HospitalMapper;
import com.thrombosis.mapper.OrdersMapper;
import com.thrombosis.mapper.PackageMapper;
import com.thrombosis.mapper.PayBillMapper;
import com.thrombosis.mapper.UserMapper;
import com.thrombosis.mapper.VerifyRecordMapper;
import com.thrombosis.security.JwtUtil;
import com.thrombosis.security.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserMapper userMapper;
    private final PackageMapper packageMapper;
    private final OrdersMapper ordersMapper;
    private final VerifyRecordMapper verifyRecordMapper;
    private final PayBillMapper payBillMapper;
    private final HospitalMapper hospitalMapper;
    private final JwtUtil jwtUtil;

    // ---------- 登录 ----------
    public Map<String, Object> login(String account, String password) {
        User u = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getPhone, account));
        if (u == null || (!"admin".equals(u.getRole()) && !"hospital_admin".equals(u.getRole()))) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "账号或密码错误");
        }
        if (u.getPassword() == null || !new BCryptPasswordEncoder().matches(password, u.getPassword())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "账号或密码错误");
        }
        if (!Integer.valueOf(1).equals(u.getStatus())) {
            // 禁用账号（status=0）拒绝登录，保证管理员被停用后无法再获取新 token
            throw new BusinessException(ErrorCode.FORBIDDEN, "账号已禁用，请联系管理员");
        }
        Map<String, Object> r = new HashMap<>();
        r.put("token", jwtUtil.generate(u.getId(), u.getRole(), u.getHospitalId()));
        r.put("userId", u.getId());
        r.put("nickname", u.getNickname());
        r.put("role", u.getRole());
        r.put("hospitalId", u.getHospitalId());
        // 医院管理员：从数据库关联返回医院名称（前端顶部展示，非写死）
        r.put("hospitalName", hospitalNameOf(u.getHospitalId()));
        return r;
    }

    // ---------- 当前账号信息（含所属医院名称） ----------
    public Map<String, Object> me(String role, Long userId, Long hospitalId) {
        User u = userMapper.selectById(userId);
        if (u == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "账号不存在");
        }
        Map<String, Object> r = new HashMap<>();
        r.put("userId", u.getId());
        r.put("nickname", u.getNickname());
        r.put("role", u.getRole());
        r.put("hospitalId", u.getHospitalId());
        r.put("hospitalName", hospitalNameOf(u.getHospitalId()));
        return r;
    }

    /** 关联查询医院名称；无医院或不存在返回 null */
    private String hospitalNameOf(Long hospitalId) {
        if (hospitalId == null) return null;
        Hospital h = hospitalMapper.selectById(hospitalId);
        return h == null ? null : h.getName();
    }

    /** 多租户数据隔离核心：计算实际生效的 hospitalId。
     *  hospital_admin 一律锁定当前账号所属医院，忽略前端传入值，杜绝越权；
     *  admin 使用前端显式指定的 hospitalId（可为 null = 全量）。 */
    private Long resolveHospitalId(String role, Long reqHospitalId) {
        if ("hospital_admin".equals(role)) {
            Long hid = UserContext.get() == null ? null : UserContext.get().getHospitalId();
            if (hid == null) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "账号未绑定医院，无法操作");
            }
            return hid;
        }
        return reqHospitalId;
    }

    /** User -> AccountVO（附带医院名称） */
    private AccountVO toAccountVO(User u) {
        if (u == null) return null;
        AccountVO vo = new AccountVO();
        vo.setId(u.getId());
        vo.setPhone(u.getPhone());
        vo.setNickname(u.getNickname());
        vo.setRole(u.getRole());
        vo.setHospitalId(u.getHospitalId());
        vo.setHospitalName(hospitalNameOf(u.getHospitalId()));
        vo.setStatus(u.getStatus());
        vo.setCreatedAt(u.getCreatedAt());
        return vo;
    }

    // ---------- 医护管理（医院端：锁本院；平台端：可全量/按医院） ----------
    public PageResult<AccountVO> staffs(String role, Long reqHospitalId, String keyword,
                                        int page, int pageSize) {
        Long effHid = resolveHospitalId(role, reqHospitalId);
        LambdaQueryWrapper<User> qw = new LambdaQueryWrapper<User>()
                .eq(User::getRole, "staff")
                .orderByDesc(User::getId);
        if (effHid != null) qw.eq(User::getHospitalId, effHid);
        if (keyword != null && !keyword.isBlank()) {
            qw.and(w -> w.like(User::getPhone, keyword).or().like(User::getNickname, keyword));
        }
        Page<User> p = new Page<>(page, pageSize);
        userMapper.selectPage(p, qw);
        List<AccountVO> list = p.getRecords().stream().map(this::toAccountVO).toList();
        return PageResult.of(list, p.getTotal(), page, pageSize);
    }

    @Transactional
    public AccountVO createStaff(String role, AdminUserSaveRequest req) {
        // 账号查重
        checkPhoneUnique(req.getPhone(), null);
        // 强制校验密码
        if (req.getPassword() == null || req.getPassword().isBlank()) {
            throw new BusinessException(ErrorCode.SERVER_ERROR, "请输入初始密码");
        }
        // 医院管理员只能给本院新增医护；平台管理员必须显式指定医院
        Long effHid = resolveHospitalId(role, req.getHospitalId());
        if (effHid == null) {
            throw new BusinessException(ErrorCode.SERVER_ERROR, "请选择所属医院");
        }
        User u = new User();
        u.setPhone(req.getPhone());
        u.setPassword(new BCryptPasswordEncoder().encode(req.getPassword()));
        u.setNickname(req.getNickname() == null || req.getNickname().isBlank() ? "医护" : req.getNickname());
        u.setRole("staff");
        u.setHospitalId(effHid);
        u.setStatus(req.getStatus() == null ? 1 : req.getStatus());
        u.setCreatedAt(LocalDateTime.now());
        userMapper.insert(u);
        return toAccountVO(u);
    }

    @Transactional
    public AccountVO updateStaff(String role, Long id, AdminUserSaveRequest req) {
        User u = requireAccount(id, "医护");
        // 数据隔离：医院管理员只能改本院医护
        assertOwnHospital(role, u);
        // 修改手机号时查重（排除自身）
        checkPhoneUnique(req.getPhone(), id);
        if (req.getPhone() != null && !req.getPhone().isBlank()) u.setPhone(req.getPhone());
        if (req.getNickname() != null && !req.getNickname().isBlank()) u.setNickname(req.getNickname());
        if (req.getStatus() != null) u.setStatus(req.getStatus());
        // 密码：编辑时留空不修改
        if (req.getPassword() != null && !req.getPassword().isBlank()) {
            u.setPassword(new BCryptPasswordEncoder().encode(req.getPassword()));
        }
        u.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(u);
        return toAccountVO(userMapper.selectById(id));
    }

    @Transactional
    public void deleteStaff(String role, Long id) {
        User u = requireAccount(id, "医护");
        assertOwnHospital(role, u);
        userMapper.deleteById(id);
    }

    @Transactional
    public void resetStaffPassword(String role, Long id, String newPassword) {
        if (newPassword == null || newPassword.length() < 6) {
            throw new BusinessException(ErrorCode.SERVER_ERROR, "新密码长度需在 6-32 位");
        }
        User u = requireAccount(id, "医护");
        assertOwnHospital(role, u);
        u.setPassword(new BCryptPasswordEncoder().encode(newPassword));
        u.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(u);
    }

    // ---------- 医院管理员管理（仅平台管理员，新增必须指定医院） ----------
    public PageResult<AccountVO> hospitalAdmins(String keyword, Long hospitalId, int page, int pageSize) {
        LambdaQueryWrapper<User> qw = new LambdaQueryWrapper<User>()
                .eq(User::getRole, "hospital_admin")
                .orderByDesc(User::getId);
        if (hospitalId != null) qw.eq(User::getHospitalId, hospitalId);
        if (keyword != null && !keyword.isBlank()) {
            qw.and(w -> w.like(User::getPhone, keyword).or().like(User::getNickname, keyword));
        }
        Page<User> p = new Page<>(page, pageSize);
        userMapper.selectPage(p, qw);
        List<AccountVO> list = p.getRecords().stream().map(this::toAccountVO).toList();
        return PageResult.of(list, p.getTotal(), page, pageSize);
    }

    @Transactional
    public AccountVO createHospitalAdmin(AdminUserSaveRequest req) {
        if (req.getHospitalId() == null) {
            throw new BusinessException(ErrorCode.SERVER_ERROR, "请选择所属医院");
        }
        if (hospitalMapper.selectById(req.getHospitalId()) == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "所选医院不存在");
        }
        if (req.getPassword() == null || req.getPassword().isBlank()) {
            throw new BusinessException(ErrorCode.SERVER_ERROR, "请输入初始密码");
        }
        checkPhoneUnique(req.getPhone(), null);
        User u = new User();
        u.setPhone(req.getPhone());
        u.setPassword(new BCryptPasswordEncoder().encode(req.getPassword()));
        u.setNickname(req.getNickname() == null || req.getNickname().isBlank() ? "医院管理员" : req.getNickname());
        u.setRole("hospital_admin");
        u.setHospitalId(req.getHospitalId());
        u.setStatus(req.getStatus() == null ? 1 : req.getStatus());
        u.setCreatedAt(LocalDateTime.now());
        userMapper.insert(u);
        return toAccountVO(u);
    }

    @Transactional
    public AccountVO updateHospitalAdmin(Long id, AdminUserSaveRequest req) {
        User u = requireAccount(id, "医院管理员");
        if (req.getHospitalId() != null) {
            if (hospitalMapper.selectById(req.getHospitalId()) == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "所选医院不存在");
            }
            u.setHospitalId(req.getHospitalId());
        }
        if (req.getPhone() != null && !req.getPhone().isBlank()) {
            checkPhoneUnique(req.getPhone(), id);
            u.setPhone(req.getPhone());
        }
        if (req.getNickname() != null && !req.getNickname().isBlank()) u.setNickname(req.getNickname());
        if (req.getStatus() != null) u.setStatus(req.getStatus());
        if (req.getPassword() != null && !req.getPassword().isBlank()) {
            u.setPassword(new BCryptPasswordEncoder().encode(req.getPassword()));
        }
        u.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(u);
        return toAccountVO(userMapper.selectById(id));
    }

    @Transactional
    public void deleteHospitalAdmin(Long id) {
        User u = requireAccount(id, "医院管理员");
        userMapper.deleteById(id);
    }

    @Transactional
    public void resetHospitalAdminPassword(Long id, String newPassword) {
        if (newPassword == null || newPassword.length() < 6) {
            throw new BusinessException(ErrorCode.SERVER_ERROR, "新密码长度需在 6-32 位");
        }
        User u = requireAccount(id, "医院管理员");
        u.setPassword(new BCryptPasswordEncoder().encode(newPassword));
        u.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(u);
    }

    // ---------- 通用私有工具 ----------

    private User requireAccount(Long id, String type) {
        User u = userMapper.selectById(id);
        if (u == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, type + "不存在");
        }
        return u;
    }

    /** 数据隔离：医院管理员操作的目标账号必须属于当前账号的医院 */
    private void assertOwnHospital(String role, User target) {
        if ("hospital_admin".equals(role)) {
            Long hid = UserContext.get() == null ? null : UserContext.get().getHospitalId();
            if (hid == null || !hid.equals(target.getHospitalId())) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "无权操作其他医院的账号");
            }
        }
    }

    /** 登录账号查重（编辑时排除自身） */
    private void checkPhoneUnique(String phone, Long excludeId) {
        if (phone == null || phone.isBlank()) return;
        LambdaQueryWrapper<User> qw = new LambdaQueryWrapper<User>().eq(User::getPhone, phone);
        if (excludeId != null) qw.ne(User::getId, excludeId);
        Long cnt = userMapper.selectCount(qw);
        if (cnt != null && cnt > 0) {
            throw new BusinessException(ErrorCode.PHONE_REGISTERED, "账号已存在");
        }
    }

    // ---------- 工作台统计 ----------
    public Map<String, Object> statistics(String role, Long hospitalId) {
        LocalDate today = LocalDate.now();
        Map<String, Object> r = new HashMap<>();
        // 已支付 = paid/verified/completed（核销/完成也算销售，统一口径）
        List<String> PAID = Arrays.asList("paid", "verified", "completed");
        if ("hospital_admin".equals(role)) {
            // 医院端：仅业务量，无金额（锁定本院）
            Long todayOrders = ordersMapper.selectCount(new LambdaQueryWrapper<Orders>()
                    .eq(Orders::getHospitalId, hospitalId)
                    .in(Orders::getStatus, PAID)
                    .isNotNull(Orders::getPayTime)
                    .ge(Orders::getPayTime, today.atStartOfDay())
                    .lt(Orders::getPayTime, today.plusDays(1).atStartOfDay()));
            Long todayVerified = verifyRecordMapper.selectCount(new LambdaQueryWrapper<VerifyRecord>()
                    .eq(VerifyRecord::getHospitalId, hospitalId)
                    .ge(VerifyRecord::getVerifyTime, today.atStartOfDay())
                    .lt(VerifyRecord::getVerifyTime, today.plusDays(1).atStartOfDay()));
            Long pendingVerify = ordersMapper.selectCount(new LambdaQueryWrapper<Orders>()
                    .eq(Orders::getHospitalId, hospitalId)
                    .eq(Orders::getStatus, "paid").isNull(Orders::getVerifyTime));
            Long totalPackages = verifyRecordMapper.selectCount(new LambdaQueryWrapper<VerifyRecord>()
                    .eq(VerifyRecord::getHospitalId, hospitalId));
            r.put("todayOrders", nz(todayOrders));
            r.put("todayVerified", nz(todayVerified));
            r.put("pendingVerify", nz(pendingVerify));
            r.put("totalPackages", nz(totalPackages));
            r.put("trend", verifyTrend(hospitalId, 7));
            r.put("packageShare", packageShareByHospital(hospitalId));
        } else {
            // 平台端：完整统计（已支付口径，按 pay_time）
            List<Orders> todayPaid = ordersMapper.selectList(new LambdaQueryWrapper<Orders>()
                    .in(Orders::getStatus, PAID)
                    .isNotNull(Orders::getPayTime)
                    .ge(Orders::getPayTime, today.atStartOfDay()));
            BigDecimal todaySales = sumAmount(todayPaid);
            Long todayOrders = ordersMapper.selectCount(new LambdaQueryWrapper<Orders>()
                    .in(Orders::getStatus, PAID)
                    .isNotNull(Orders::getPayTime)
                    .ge(Orders::getPayTime, today.atStartOfDay()));
            Long pendingVerify = ordersMapper.selectCount(new LambdaQueryWrapper<Orders>()
                    .eq(Orders::getStatus, "paid").isNull(Orders::getVerifyTime));
            List<Orders> allPaid = ordersMapper.selectList(new LambdaQueryWrapper<Orders>()
                    .in(Orders::getStatus, PAID)
                    .isNotNull(Orders::getPayTime));
            BigDecimal totalSold = sumAmount(allPaid);
            r.put("todaySales", todaySales);
            r.put("todayOrders", nz(todayOrders));
            r.put("pendingVerify", nz(pendingVerify));
            r.put("totalSold", totalSold);
            r.put("trend", salesTrend(7));
            r.put("hospitalShare", hospitalShare());
        }
        return r;
    }

    private BigDecimal sumAmount(List<Orders> list) {
        return list.stream()
                .map(o -> o.getPayAmount() == null ? BigDecimal.ZERO : o.getPayAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** 平台：近 7 日销售额（已支付口径） */
    private List<Map<String, Object>> salesTrend(int days) {
        List<String> PAID = Arrays.asList("paid", "verified", "completed");
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate d = LocalDate.now().minusDays(i);
            List<Orders> list = ordersMapper.selectList(new LambdaQueryWrapper<Orders>()
                    .in(Orders::getStatus, PAID)
                    .isNotNull(Orders::getPayTime)
                    .ge(Orders::getPayTime, d.atStartOfDay())
                    .lt(Orders::getPayTime, d.plusDays(1).atStartOfDay()));
            Map<String, Object> m = new HashMap<>();
            m.put("date", d.format(DateTimeFormatter.ofPattern("MM-dd")));
            m.put("value", sumAmount(list));
            out.add(m);
        }
        return out;
    }

    /** 医院：近 7 日核销数（绿色折线） */
    private List<Map<String, Object>> verifyTrend(Long hospitalId, int days) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate d = LocalDate.now().minusDays(i);
            Long c = verifyRecordMapper.selectCount(new LambdaQueryWrapper<VerifyRecord>()
                    .eq(VerifyRecord::getHospitalId, hospitalId)
                    .ge(VerifyRecord::getVerifyTime, d.atStartOfDay())
                    .lt(VerifyRecord::getVerifyTime, d.plusDays(1).atStartOfDay()));
            Map<String, Object> m = new HashMap<>();
            m.put("date", d.format(DateTimeFormatter.ofPattern("MM-dd")));
            m.put("value", nz(c));
            out.add(m);
        }
        return out;
    }

    /** 平台：各医院售卖占比 */
    private List<Map<String, Object>> hospitalShare() {
        List<VerifyRecord> all = verifyRecordMapper.selectList(null);
        Map<Long, Integer> count = new HashMap<>();
        all.forEach(v -> count.merge(v.getHospitalId(), 1, Integer::sum));
        List<Map<String, Object>> out = new ArrayList<>();
        count.forEach((hid, c) -> {
            Hospital h = hospitalMapper.selectById(hid);
            Map<String, Object> m = new HashMap<>();
            m.put("name", h == null ? ("医院" + hid) : h.getName());
            m.put("value", c);
            out.add(m);
        });
        return out;
    }

    /** 医院：本院套餐占比 */
    private List<Map<String, Object>> packageShareByHospital(Long hospitalId) {
        List<VerifyRecord> all = verifyRecordMapper.selectList(new LambdaQueryWrapper<VerifyRecord>()
                .eq(VerifyRecord::getHospitalId, hospitalId));
        Map<String, Integer> count = new LinkedHashMap<>();
        all.forEach(v -> count.merge(v.getPackageName(), 1, Integer::sum));
        List<Map<String, Object>> out = new ArrayList<>();
        count.forEach((name, c) -> {
            Map<String, Object> m = new HashMap<>();
            m.put("name", name);
            m.put("value", c);
            out.add(m);
        });
        return out;
    }

    private long nz(Long v) {
        return v == null ? 0 : v;
    }

    // ---------- 套餐管理 ----------
    public PageResult<Package> packages(int page, int pageSize, String keyword, String status) {
        LambdaQueryWrapper<Package> qw = new LambdaQueryWrapper<Package>()
                .orderByDesc(Package::getCreatedAt);
        if (keyword != null && !keyword.isBlank()) {
            qw.like(Package::getName, keyword);
        }
        if (status != null && !status.isBlank()) {
            qw.eq(Package::getStatus, status);
        }
        Page<Package> p = new Page<>(page, pageSize);
        packageMapper.selectPage(p, qw);
        return PageResult.of(p.getRecords(), p.getTotal(), page, pageSize);
    }

    public Package createPackage(Package pkg) {
        if (pkg.getPrice() == null || pkg.getPrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.SERVER_ERROR, "价格必须大于 0");
        }
        if (pkg.getStatus() == null) pkg.setStatus("on");
        pkg.setSalesCount(pkg.getSalesCount() == null ? 0 : pkg.getSalesCount());
        pkg.setHospitalCount(pkg.getHospitalCount() == null ? 0 : pkg.getHospitalCount());
        pkg.setCreatedAt(LocalDateTime.now());
        packageMapper.insert(pkg);
        return pkg;
    }

    public Package updatePackage(Long id, Package pkg) {
        Package exist = packageMapper.selectById(id);
        if (exist == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "套餐不存在");
        }
        if (pkg.getPrice() != null && pkg.getPrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.SERVER_ERROR, "价格必须大于 0");
        }
        pkg.setId(id);
        pkg.setSalesCount(exist.getSalesCount());
        pkg.setCreatedAt(exist.getCreatedAt());
        packageMapper.updateById(pkg);
        return packageMapper.selectById(id);
    }

    public void togglePackageStatus(Long id, String status) {
        Package exist = packageMapper.selectById(id);
        if (exist == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "套餐不存在");
        }
        exist.setStatus(status);
        packageMapper.updateById(exist);
    }

    // ---------- 核销记录（管理端） ----------
    public PageResult<VerifyRecord> verifyRecords(String role, Long hospitalId, Long filterHospitalId,
                                                  LocalDate dateFrom, LocalDate dateTo, String status,
                                                  int page, int pageSize) {
        LambdaQueryWrapper<VerifyRecord> qw = new LambdaQueryWrapper<VerifyRecord>()
                .orderByDesc(VerifyRecord::getVerifyTime);
        // 医院管理员锁定本院
        Long effHid = "hospital_admin".equals(role) ? hospitalId : filterHospitalId;
        if (effHid != null) {
            qw.eq(VerifyRecord::getHospitalId, effHid);
        }
        if (dateFrom != null) qw.ge(VerifyRecord::getVerifyTime, dateFrom.atStartOfDay());
        if (dateTo != null) qw.lt(VerifyRecord::getVerifyTime, dateTo.plusDays(1).atStartOfDay());
        if (status != null && !status.isBlank()) qw.eq(VerifyRecord::getStatus, status);
        Page<VerifyRecord> p = new Page<>(page, pageSize);
        verifyRecordMapper.selectPage(p, qw);
        return PageResult.of(p.getRecords(), p.getTotal(), page, pageSize);
    }

    // ---------- 售卖记录 ----------
    public PageResult<Map<String, Object>> sales(String role, Long hospitalId, int page, int pageSize) {
        LambdaQueryWrapper<Orders> qw = new LambdaQueryWrapper<Orders>()
                .orderByDesc(Orders::getCreatedAt);
        if ("hospital_admin".equals(role)) {
            // 医院端：仅本院已完成（核销即完成）记录，且金额隐藏
            qw.eq(Orders::getStatus, "completed").eq(Orders::getHospitalId, hospitalId);
        }
        Page<Orders> p = new Page<>(page, pageSize);
        ordersMapper.selectPage(p, qw);
        boolean hideMoney = "hospital_admin".equals(role);
        List<Map<String, Object>> list = p.getRecords().stream().map(o -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", o.getId());
            m.put("orderNo", o.getOrderNo());
            m.put("packageName", o.getPackageName());
            m.put("userId", o.getUserId());
            m.put("payChannel", o.getPayChannel());
            m.put("status", o.getStatus());
            m.put("createdAt", o.getCreatedAt());
            m.put("verifyTime", o.getVerifyTime());
            if (!hideMoney) {
                m.put("amount", o.getAmount());
                m.put("payAmount", o.getPayAmount());
            } else {
                m.put("amount", null);
                m.put("payAmount", null);
            }
            User u = userMapper.selectById(o.getUserId());
            m.put("userPhone", u == null ? "" : AuthService.maskPhone(u.getPhone()));
            return m;
        }).toList();
        return PageResult.of(list, p.getTotal(), page, pageSize);
    }

    // ---------- 支付账单 ----------
    public PageResult<PayBill> bills(String channel, int page, int pageSize) {
        LambdaQueryWrapper<PayBill> qw = new LambdaQueryWrapper<PayBill>()
                .orderByDesc(PayBill::getPaidAt);
        if (channel != null && !channel.isBlank()) {
            qw.eq(PayBill::getChannel, channel);
        }
        Page<PayBill> p = new Page<>(page, pageSize);
        payBillMapper.selectPage(p, qw);
        return PageResult.of(p.getRecords(), p.getTotal(), page, pageSize);
    }

    @Transactional
    public PayBill syncBill(Long id) {
        PayBill bill = payBillMapper.selectById(id);
        if (bill == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "账单不存在");
        }
        // 模拟重新同步：与平台订单对账一致
        Orders o = ordersMapper.selectById(bill.getOrderId());
        if (o != null && "paid".equals(o.getStatus())) {
            bill.setReconcileStatus("ok");
            bill.setSyncAt(LocalDateTime.now());
            payBillMapper.updateById(bill);
        }
        return bill;
    }

    // ---------- 医院 CRUD（仅平台管理员） ----------
    public List<Hospital> hospitals(String keyword) {
        LambdaQueryWrapper<Hospital> qw = new LambdaQueryWrapper<Hospital>().orderByAsc(Hospital::getId);
        if (keyword != null && !keyword.isBlank()) {
            qw.and(w -> w.like(Hospital::getName, keyword).or().like(Hospital::getCity, keyword));
        }
        return hospitalMapper.selectList(qw);
    }

    public Hospital createHospital(Hospital h) {
        if (h.getStatus() == null) h.setStatus("cooperating");
        h.setCreatedAt(LocalDateTime.now());
        hospitalMapper.insert(h);
        return h;
    }

    public Hospital updateHospital(Long id, Hospital h) {
        Hospital exist = hospitalMapper.selectById(id);
        if (exist == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "医院不存在");
        }
        h.setId(id);
        hospitalMapper.updateById(h);
        return hospitalMapper.selectById(id);
    }

    public void deleteHospital(Long id) {
        hospitalMapper.deleteById(id);
    }
}
