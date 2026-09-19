import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Docker 배포용 (필요한 파일만 모아 .next/standalone에 생성)
};

export default nextConfig;
