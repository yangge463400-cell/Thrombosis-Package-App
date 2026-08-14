package com.thrombosis.controller;

import com.thrombosis.common.Result;
import com.thrombosis.dto.PageResult;
import com.thrombosis.entity.Message;
import com.thrombosis.security.UserContext;
import com.thrombosis.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;

    @GetMapping
    public Result<PageResult<Message>> list(
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        return Result.ok(messageService.list(UserContext.currentUserId(), type, page, pageSize));
    }

    @GetMapping("/{id}")
    public Result<Message> detail(@PathVariable Long id) {
        return Result.ok(messageService.detail(UserContext.currentUserId(), id, false));
    }

    @PutMapping("/{id}/read")
    public Result<Void> markRead(@PathVariable Long id) {
        messageService.detail(UserContext.currentUserId(), id, true);
        return Result.ok();
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        messageService.delete(UserContext.currentUserId(), id);
        return Result.ok();
    }
}
