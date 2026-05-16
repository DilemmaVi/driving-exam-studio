import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  const headers = [
    "题库ID", "题目类型", "题目", "题目内容",
    "答案1", "答案2", "答案3", "答案4",
    "正确答案", "官方解读",
    "技巧(用于生成语音的技巧文字)", "技巧（前端技巧弹窗显示内容）",
    "封面（图片地址）", "动图地址（图片动图）", "关键字",
  ];

  const sampleRows = [
    {
      "题库ID": 1,
      "题目类型": 2,
      "题目": "在高速公路上行驶时，以下哪种情况需要开启【危险报警闪光灯】？",
      "题目内容": "在高速公路上行驶时，以下哪种情况需要开启【危险报警闪光灯】？",
      "答案1": "车辆发生【故障】需要临时停车",
      "答案2": "正常行驶超车时",
      "答案3": "进入高速公路时",
      "答案4": "在服务区休息时",
      "正确答案": "[\"1\"]",
      "官方解读": "车辆在高速公路上发生故障需要临时停车时，应开启危险报警闪光灯，并在车后方150米外设置警告标志。",
      "技巧(用于生成语音的技巧文字)": "记住：高速故障=双闪+三角牌150米",
      "技巧（前端技巧弹窗显示内容）": "高速故障 → 双闪 + 三角牌150米",
      "封面（图片地址）": "",
      "动图地址（图片动图）": "",
      "关键字": "危险报警闪光灯,故障,临时停车",
    },
    {
      "题库ID": 2,
      "题目类型": 1,
      "题目": "驾驶机动车在道路上违反交通安全法规的行为属于违法行为。",
      "题目内容": "驾驶机动车在道路上违反交通安全法规的行为属于{违法}行为。",
      "答案1": "正确",
      "答案2": "错误",
      "答案3": "",
      "答案4": "",
      "正确答案": "[\"1\"]",
      "官方解读": "违反交通安全法律法规的行为，属于违法行为，不是违章行为。",
      "技巧(用于生成语音的技巧文字)": "关键词是违法，不是违章，记住这个区别就行",
      "技巧（前端技巧弹窗显示内容）": "违法 ≠ 违章",
      "封面（图片地址）": "",
      "动图地址（图片动图）": "",
      "关键字": "违法,违章",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleRows, { header: headers });

  // Set column widths
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length * 2, 12) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "题目模板");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=import_template.xlsx",
    },
  });
}
