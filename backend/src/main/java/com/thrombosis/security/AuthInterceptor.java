package com.thrombosis.security;

import com.thrombosis.common.ErrorCode;
import com.thrombosis.common.Result;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;

/**
 * 认证拦截器：
 * 1. 公开路径放行（见 WebMvcConfig 注册的 exclusions）
 * 2. 其余接口要求 Authorization: Bearer <token>，解析后填充 UserContext
 * 3. 方法带 @RequireRole 时校验角色，不匹配返回 403
 */
@Component
@RequiredArgsConstructor
public class AuthInterceptor implements HandlerInterceptor {

    private final JwtUtil jwtUtil;
    private final ObjectMapper objectMapper;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // CORS 预检直接放行
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        // 非 Controller 方法（如静态资源/error）放行
        if (!(handler instanceof HandlerMethod hm)) {
            return true;
        }

        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            return reject(response, ErrorCode.UNAUTHORIZED, "未登录或登录已过期");
        }
        Claims claims = jwtUtil.parse(header.substring(7));
        if (claims == null) {
            return reject(response, ErrorCode.UNAUTHORIZED, "未登录或登录已过期");
        }

        UserContext ctx = new UserContext(
                jwtUtil.getUserId(claims),
                jwtUtil.getRole(claims),
                jwtUtil.getHospitalId(claims));
        UserContext.set(ctx);

        // 角色校验
        RequireRole rr = hm.getMethodAnnotation(RequireRole.class);
        if (rr == null) {
            rr = hm.getBeanType().getAnnotation(RequireRole.class);
        }
        if (rr != null) {
            List<String> allowed = Arrays.asList(rr.value());
            if (!allowed.contains(ctx.getRole())) {
                UserContext.clear();
                return reject(response, ErrorCode.FORBIDDEN, "无权限访问");
            }
        }
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        UserContext.clear();
    }

    private boolean reject(HttpServletResponse response, int code, String message) throws IOException {
        response.setStatus(200);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(objectMapper.writeValueAsString(Result.error(code, message)));
        return false;
    }
}
