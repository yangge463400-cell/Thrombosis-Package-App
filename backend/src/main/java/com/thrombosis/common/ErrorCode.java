package com.thrombosis.common;

/**
 * 错误码约定（规格文档 7.3 / 接口契约清单）
 */
public final class ErrorCode {
    public static final int OK = 0;
    /** 未登录 / token 失效 */
    public static final int UNAUTHORIZED = 401;
    /** 无权限 */
    public static final int FORBIDDEN = 403;
    /** 资源不存在 */
    public static final int NOT_FOUND = 404;
    /** 验证码错误 */
    public static final int SMS_CODE_ERROR = 1001;
    /** 手机号已注册 */
    public static final int PHONE_REGISTERED = 1002;
    /** 订单不可支付 */
    public static final int ORDER_NOT_PAYABLE = 2001;
    /** 核销码无效/已使用/已过期 */
    public static final int VERIFY_CODE_INVALID = 2002;
    /** 服务异常 */
    public static final int SERVER_ERROR = 500;

    private ErrorCode() {}
}
