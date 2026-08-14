package com.thrombosis.controller;

import com.thrombosis.common.Result;
import com.thrombosis.dto.LoginRequest;
import com.thrombosis.dto.RegisterRequest;
import com.thrombosis.dto.SendCodeRequest;
import com.thrombosis.dto.UserVO;
import com.thrombosis.dto.WechatLoginResult;
import com.thrombosis.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/wechat-login")
    public Result<WechatLoginResult> wechatLogin(@Valid @RequestBody LoginRequest req) {
        return Result.ok(authService.wechatLogin(req.getCode()));
    }

    @PostMapping("/send-code")
    public Result<Void> sendCode(@Valid @RequestBody SendCodeRequest req) {
        authService.sendCode(req.getPhone());
        return Result.ok();
    }

    @PostMapping("/register")
    public Result<UserVO> register(@Valid @RequestBody RegisterRequest req) {
        return Result.ok(authService.register(req.getRegisterTicket(), req.getPhone(),
                req.getCode(), req.getNickname(), req.getAvatar()));
    }

    @PostMapping("/logout")
    public Result<Void> logout() {
        // 前端清除本地 token 即可；后端无状态
        return Result.ok();
    }
}
