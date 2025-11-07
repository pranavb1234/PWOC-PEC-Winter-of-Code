import * as XLSX from 'xlsx';
import fs from 'fs';

export const exportToExcel = (data, filename) => {
  const worksheetData = data.map((entry, index) => ({
    Rank: index + 1,
    Name: entry.user.name,
    Username: entry.user.username,
    Points: entry.points,
    PR_Count: entry.pullRequests.length,
    GitHub: entry.user.html_url,
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leaderboard');

  XLSX.writeFile(workbook, filename);
};
