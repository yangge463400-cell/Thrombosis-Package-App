package com.thrombosis.controller;

import com.thrombosis.common.Result;
import com.thrombosis.security.UserContext;
import com.thrombosis.service.HomeService;
import com.thrombosis.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class HomeController {

    private final HomeService homeService;
    private final MessageService messageService;

    @GetMapping("/home")
    public Result<Map<String, Object>> home() {
        return Result.ok(homeService.aggregate(UserContext.currentUserId()));
    }

    @GetMapping("/messages/unread-count")
    public Result<Map<String, Object>> unreadCount() {
        long c = messageService.unreadCount(UserContext.currentUserId());
        return Result.ok(Map.of("count", c));
    }
}
