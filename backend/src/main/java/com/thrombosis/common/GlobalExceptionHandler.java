package com.thrombosis.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public Result<Void> handleBusiness(BusinessException e) {
        return Result.error(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleValidation(MethodArgumentNotValidException e) {
        FieldError fe = e.getBindingResult().getFieldError();
        String msg = fe == null ? "参数校验失败" : fe.getDefaultMessage();
        return Result.error(ErrorCode.PARAM_ERROR, msg);
    }

    /** 请求体不可读：JSON 格式错误 / 字段类型不符 / 未知字段（Jackson 严格模式）→ 400 参数错误而非 500 */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public Result<Void> handleNotReadable(HttpMessageNotReadableException e) {
        log.warn("Bad request body: {}", e.getMessage());
        return Result.error(ErrorCode.PARAM_ERROR, "请求体格式错误或包含无法识别的字段");
    }

    /** 查询/路径参数类型错误（如 page=abc）→ 400 参数错误而非 500 */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public Result<Void> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return Result.error(ErrorCode.PARAM_ERROR, "参数类型错误：" + e.getName());
    }

    @ExceptionHandler(Exception.class)
    public Result<Void> handleOther(Exception e) {
        log.error("Unhandled exception", e);
        return Result.error(ErrorCode.SERVER_ERROR, "服务异常，请稍后重试");
    }
}
