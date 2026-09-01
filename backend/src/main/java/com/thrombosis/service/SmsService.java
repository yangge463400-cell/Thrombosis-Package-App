package com.thrombosis.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

/**
 * 腾讯云短信（国内）最小客户端：TC3-HMAC-SHA256 签名调用 SendSms。
 * 纯 JDK 实现，无第三方依赖。
 * 未配置凭据时 configured()=false，调用方（AuthService）保持 fail-closed。
 */
@Slf4j
@Service
public class SmsService {

    private static final String HOST = "sms.tencentcloudapi.com";
    private static final String SERVICE = "sms";
    private static final String VERSION = "2021-01-11";
    private static final ObjectMapper M = new ObjectMapper();

    @Value("${thrombosis.sms.secret-id:}")
    private String secretId;
    @Value("${thrombosis.sms.secret-key:}")
    private String secretKey;
    @Value("${thrombosis.sms.sdk-app-id:}")
    private String sdkAppId;
    @Value("${thrombosis.sms.sign-name:}")
    private String signName;
    @Value("${thrombosis.sms.template-id:}")
    private String templateId;
    /** 国内短信 Region 置空即可（官方 V3 签名规范允许空 Region 段） */
    @Value("${thrombosis.sms.region:}")
    private String region;

    /** 五项凭据/配置齐备才算接入完成 */
    public boolean configured() {
        return notBlank(secretId) && notBlank(secretKey) && notBlank(sdkAppId)
                && notBlank(signName) && notBlank(templateId);
    }

    /**
     * 发送验证码短信（国内号码，自动补 +86）。
     * 模板需含两个占位符：{1}=验证码，{2}=有效期（分钟）。
     *
     * @throws IllegalStateException 发送失败，message 为可解释原因
     */
    public void sendVerifyCode(String phone, String code, int ttlMinutes) {
        try {
            long ts = System.currentTimeMillis() / 1000;
            String payload = M.writeValueAsString(Map.of(
                    "PhoneNumberSet", new String[]{"+86" + phone},
                    "SmsSdkAppId", sdkAppId,
                    "SignName", signName,
                    "TemplateId", templateId,
                    "TemplateParamSet", new String[]{code, String.valueOf(ttlMinutes)}));

            HttpRequest req = HttpRequest.newBuilder(URI.create("https://" + HOST + "/"))
                    .header("Content-Type", "application/json")
                    .header("X-TC-Action", "SendSms")
                    .header("X-TC-Version", VERSION)
                    .header("X-TC-Timestamp", String.valueOf(ts))
                    .header("Authorization", tc3Authorization(payload, ts))
                    .timeout(Duration.ofSeconds(10))
                    .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> resp = HttpClient.newHttpClient()
                    .send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode root = M.readTree(resp.body()).path("Response");
            // 凭据/签名/配置有误时腾讯云返回 Response.Error 而非 SendStatusSet
            JsonNode apiError = root.path("Error");
            if (!apiError.isMissingNode()) {
                String eCode = apiError.path("Code").asText("");
                String eMsg = apiError.path("Message").asText("");
                log.warn("[sms] API 错误 phone={} code={} msg={}", phone, eCode, eMsg);
                throw new IllegalStateException(humanize(eCode, eMsg));
            }
            JsonNode status = root.path("SendStatusSet").path(0);
            String resultCode = status.path("Code").asText("");
            if ("Ok".equalsIgnoreCase(resultCode)) {
                log.info("[sms] 验证码已下发 phone={}", phone);
                return;
            }
            String reason = status.path("Message").asText(resultCode);
            log.warn("[sms] 下发失败 phone={} code={} msg={}", phone, resultCode, reason);
            throw new IllegalStateException(humanize(resultCode, reason));
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            log.error("[sms] 发送异常", e);
            throw new IllegalStateException("短信发送失败，请稍后重试");
        }
    }

    /** 将腾讯云错误码转为用户可理解的提示 */
    private String humanize(String code, String reason) {
        if (code.startsWith("AuthFailure")) return "短信配置错误（密钥无效），请联系管理员";
        if (code.contains("LimitExceeded")) return "发送频率超限，请稍后再试";
        if (code.contains("FailedToSend") || code.contains("InternalError")) return "短信通道繁忙，请稍后再试";
        if (code.contains("UnauthorizedOperation")) return "短信服务未授权该操作，请联系管理员";
        return "短信发送失败：" + reason;
    }

    /** TC3-HMAC-SHA256 请求签名（官方 V3 签名规范，国内短信 Region 置空） */
    private String tc3Authorization(String payload, long ts) throws Exception {
        String date = Instant.ofEpochSecond(ts).toString().substring(0, 10);
        String canonicalRequest = "POST\n/\n\n"
                + "content-type:application/json\n"
                + "host:" + HOST + "\n"
                + "\n"
                + "content-type;host\n"
                + sha256Hex(payload);
        String stringToSign = "TC3-HMAC-SHA256\n" + ts + "\n"
                + date + "/" + region + "/" + SERVICE + "/tc3_request\n"
                + sha256Hex(canonicalRequest);
        byte[] kDate = hmac256(secretKey.getBytes(StandardCharsets.UTF_8), date);
        byte[] kService = hmac256(kDate, SERVICE);
        byte[] kSigning = hmac256(kService, "tc3_request");
        String signature = hex(hmac256(kSigning, stringToSign));
        return "TC3-HMAC-SHA256 Credential=" + secretId + "/" + date + "/" + region
                + "/" + SERVICE + "/tc3_request, SignedHeaders=content-type;host, Signature=" + signature;
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String sha256Hex(String s) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
        return hex(d);
    }

    private static byte[] hmac256(byte[] key, String msg) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(msg.getBytes(StandardCharsets.UTF_8));
    }

    private static String hex(byte[] d) {
        StringBuilder sb = new StringBuilder(d.length * 2);
        for (byte b : d) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
