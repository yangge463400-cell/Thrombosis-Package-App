package com.thrombosis.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.thrombosis.common.BusinessException;
import com.thrombosis.common.ErrorCode;
import com.thrombosis.dto.ProfileUpdateRequest;
import com.thrombosis.dto.UserVO;
import com.thrombosis.entity.User;
import com.thrombosis.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserMapper userMapper;
    private final AuthService authService;

    public UserVO getProfile(Long userId) {
        User u = userMapper.selectById(userId);
        if (u == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "用户不存在");
        }
        return authService.toVO(u);
    }

    public UserVO updateProfile(Long userId, ProfileUpdateRequest req) {
        User u = userMapper.selectById(userId);
        if (u == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "用户不存在");
        }
        if (req.getGender() != null) u.setGender(req.getGender());
        if (req.getAge() != null) u.setAge(req.getAge());
        if (req.getHeight() != null) u.setHeight(req.getHeight());
        if (req.getWeight() != null) u.setWeight(req.getWeight());
        if (StringUtils.hasText(req.getNickname())) u.setNickname(req.getNickname());
        if (StringUtils.hasText(req.getAvatar())) u.setAvatar(req.getAvatar());
        userMapper.updateById(u);
        return authService.toVO(u);
    }
}
