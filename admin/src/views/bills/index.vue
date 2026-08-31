<template>
  <div>
    <div class="page-title" style="margin-bottom: 20px;">支付账单</div>
    <div class="bill-tip">微信支付在小程序内完成；支付宝对公订单由支付宝同步至平台，差异账单可重新同步。</div>

    <el-tabs v-model="channel" @tab-change="load(1)">
      <el-tab-pane label="微信支付" name="wx" />
      <el-tab-pane label="支付宝" name="alipay" />
    </el-tabs>

    <el-table :data="list" stripe>
      <el-table-column prop="tradeNo" label="账单号/交易号" width="200" />
      <el-table-column prop="orderId" label="关联订单" width="100" />
      <el-table-column label="渠道" width="100">
        <template #default="{ row }">{{ row.channel === 'wx' ? '微信' : '支付宝' }}</template>
      </el-table-column>
      <el-table-column label="金额" width="130">
        <template #default="{ row }"><MoneyText :value="row.amount" /></template>
      </el-table-column>
      <el-table-column label="交易状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'success' ? 'success' : row.status === 'refund' ? 'danger' : 'warning'">
            {{ row.status === 'success' ? '成功' : row.status === 'refund' ? '退款' : '失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="paidAt" label="支付时间" width="170" />
      <el-table-column label="对账状态" width="110">
        <template #default="{ row }">
          <el-tag :type="row.reconcileStatus === 'ok' ? 'success' : 'danger'" effect="dark">
            {{ row.reconcileStatus === 'ok' ? '已对账' : '差异' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130">
        <template #default="{ row }">
          <el-button v-if="row.reconcileStatus !== 'ok'" link type="primary" :loading="syncing === row.id" @click="onSync(row)">
            重新同步
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      style="margin-top:16px; justify-content:flex-end;"
      layout="total, prev, pager, next" :total="total" :page-size="pageSize" :current-page="page"
      @current-change="load" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { adminApi } from '../../api/modules/admin';
import { formatTime } from '../../utils/format';
import MoneyText from '../../components/MoneyText.vue';

const channel = ref('wx');
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const syncing = ref(null);

async function load(p) {
  page.value = p || 1;
  try {
    const data = await adminApi.bills({ channel: channel.value, page: page.value, pageSize: pageSize.value });
    list.value = (data.list || []).map(r => ({ ...r, paidAt: formatTime(r.paidAt) }));
    total.value = data.total;
  } catch (e) { /* toast */ }
}

async function onSync(row) {
  syncing.value = row.id;
  try {
    const bill = await adminApi.syncBill(row.id);
    row.reconcileStatus = bill.reconcileStatus;
    // 如实提示：仅订单为已支付(paid)时同步才会置为对账成功
    if (bill.reconcileStatus === 'ok') {
      ElMessage.success('重新同步完成，已对账');
    } else {
      ElMessage.warning('同步完成，但订单非已支付状态，账单仍为差异状态');
    }
  } catch (e) { /* toast */ }
  syncing.value = null;
}

onMounted(() => load(1));
</script>

<style scoped>
.bill-tip {
  background: var(--warning-bg);
  color: var(--warning-text);
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 8px;
}
</style>
