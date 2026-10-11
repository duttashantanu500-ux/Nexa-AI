import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Official Nexa mark — exact brand logo (blue) on clean white background. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADKElEQVR4nO2W/2vVVRjHX88597qcjlylEUSyGjXJkLK5Gt1CkKJfRpCEQiqJkGD1N/ST/hYWFFQQjXQQfWUkNNBMm+0LeWHM3VFtpmxta27KGPt2P+fzPP3wuVsL75ZpIcJ94PzwOefwnNfzvN/nwxEzM25iuJt5eAmgBFACuBUBrDCKrNjiPUvtug4AKySfjZS3TuZ5/0xErIouOkENROBELuL1poifhwNSmL9xgELy5u7Aqf4U3/Q6vuoKOIHYkkOcwPnRwNsnhbMDaQ4fN/JBFwq4boD55INXAl/nHJn7Y56uUo5kHT1DEV4SwBArh78zylcI++rz9Ax7vjwb4wRMb7gDxtGsgsDuWs/+es/tZcY7p2FiOsY7+OynQHbQs6tO2ZtJs/m+mI/bhN8vB5xbXoolAearb7sQ6BhwvPiIsq7CU7HS80YGLowLjR1K71Cexk7Ptodint/oMXO8tlXIB/jwh6VNuyzAvO6TszGfdhkb1ikND6cwg1hh8/o0Ox41TvziOdTiuHOV8WpGcM4RGzxwd4qX65Rvc44ff038slQXigMAAjT3RIzPpIgNJmcNkQRMDfY84aiqDIzNeF56TLlnTYpYwRdavmNLiuq7lHe/h+m5GGHxVV0GYMHV4xGnLjpq1kaMTTk+aI8xU6ywfm5IGZl0eDFa+4SpOUUkoTeD8jLHga3QNyocbY8RKS7GVQAiifE+P6d4BwfqHds3KmcuOo71BLxLKnrvNKy6TdhTmyc74PmoNeAk6ZIvZH2yOk3DJqOp09H/RyLFPwMArb8FukcdDRugsjzNszUpMuuNI1nH+Ut5mrtj+i4Lu2uV7Y+X8cKmmC+6PMdzgSgoc1EyoqDsrDXSHj5pL27I1NVMRsegUrUGtlWnE0mcY2+d0n9MebNFmJgVnqtRnnkwTVBh31Oe3pHAwRZPY5uiZpgJZgbmmI6E6XxxF0qxR+nYVIwXqCz3C79iJ5AbDjRllbWr4ZUtKSpWuoW1kYlAU6dxZcbhANPEELHC6hXKrnrHvXf4awMoFvNXE7Qg1F+C2t++/l1cM8D/Fbfae6AEUAIoAfz38Sc83YapsBNuLQAAAABJRU5ErkJggg==";

export default function Icon() {
  const buf = Buffer.from(PNG_BASE64, "base64");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=60, must-revalidate",
    },
  });
}
