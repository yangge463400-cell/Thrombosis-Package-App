package com.thrombosis.controller;

import com.thrombosis.common.Result;
import com.thrombosis.dto.ProfileUpdateRequest;
import com.thrombosis.dto.UserVO;
import com.thrombosis.security.UserContext;
import com.thrombosis.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/profile")
    public Result<UserVO> getProfile() {
        return Result.ok(userService.getProfile(UserContext.currentUserId()));
    }

    @PutMapping("/profile")
    public Result<UserVO> updateProfile(@Valid @RequestBody ProfileUpdateRequest req) {
        return Result.ok(userService.updateProfile(UserContext.currentUserId(), req));
    }
}
