import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 8787,
  amapWebKey: process.env.AMAP_WEB_KEY || '',
  // 高德 Web 服务数字签名私钥（控制台-我的应用-设置-数字签名处查看）
  // 若 Key 开启了数字签名验证（infocode=10007 INVALID_USER_SIGNATURE），必须填写
  amapWebSigSecret: process.env.AMAP_WEB_SIG_SECRET || '',
  amapJsKey: process.env.AMAP_JS_KEY || '',
  amapJsSecurity: process.env.AMAP_JS_SECURITY || '',
  dailyQuota: Number(process.env.DAILY_QUOTA) || 2000,
  drivingTtlDays: Number(process.env.DRIVING_TTL_DAYS) || 7,
  amapDrivingUrl: 'https://restapi.amap.com/v5/direction/driving',
};
