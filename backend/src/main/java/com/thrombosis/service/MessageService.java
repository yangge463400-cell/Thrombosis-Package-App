package com.thrombosis.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.thrombosis.common.BusinessException;
import com.thrombosis.common.ErrorCode;
import com.thrombosis.dto.PageResult;
import com.thrombosis.entity.Message;
import com.thrombosis.mapper.MessageMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageMapper messageMapper;

    /** 推送站内消息 */
    public void send(Long userId, String type, String title, String content,
                     String targetType, String targetId) {
        Message m = new Message();
        m.setUserId(userId);
        m.setType(type);
        m.setTitle(title);
        m.setContent(content);
        m.setIsRead(0);
        m.setTargetType(targetType);
        m.setTargetId(targetId);
        m.setCreatedAt(LocalDateTime.now());
        messageMapper.insert(m);
    }

    public long unreadCount(Long userId) {
        Long c = messageMapper.selectCount(new LambdaQueryWrapper<Message>()
                .eq(Message::getUserId, userId).eq(Message::getIsRead, 0));
        return c == null ? 0 : c;
    }

    public PageResult<Message> list(Long userId, String type, int page, int pageSize) {
        LambdaQueryWrapper<Message> qw = new LambdaQueryWrapper<Message>()
                .eq(Message::getUserId, userId)
                .orderByDesc(Message::getCreatedAt);
        if (type != null && !type.isBlank() && !"all".equals(type)) {
            qw.eq(Message::getType, type);
        }
        com.baomidou.mybatisplus.extension.plugins.pagination.Page<Message> p =
                new com.baomidou.mybatisplus.extension.plugins.pagination.Page<>(page, pageSize);
        messageMapper.selectPage(p, qw);
        return PageResult.of(p.getRecords(), p.getTotal(), page, pageSize);
    }

    public Message detail(Long userId, Long id, boolean markRead) {
        Message m = messageMapper.selectById(id);
        if (m == null || !m.getUserId().equals(userId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "消息不存在");
        }
        if (markRead && Integer.valueOf(0).equals(m.getIsRead())) {
            m.setIsRead(1);
            messageMapper.updateById(m);
        }
        return m;
    }

    public void delete(Long userId, Long id) {
        Message m = messageMapper.selectById(id);
        if (m == null || !m.getUserId().equals(userId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "消息不存在");
        }
        messageMapper.deleteById(id);
    }
}
