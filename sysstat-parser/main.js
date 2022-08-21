"use strict";

const baseColors = [
  '#3366CC', '#DC3912', '#FF9900', '#109618', '#990099', '#3B3EAC', '#0099C6', '#DD4477', '#66AA00', '#B82E2E',
  '#316395', '#994499', '#22AA99', '#AAAA11', '#6633CC', '#E67300', '#8B0707', '#329262', '#5574A6', '#3B3EAC',
];

// Allow hiding/showing tooltips
let showToolTips = true;
const elTooltipButton = document.querySelector('#hide_tooltip_button');
elTooltipButton.addEventListener('click', () => {
  showToolTips = !showToolTips;
  elTooltipButton.value = showToolTips ? 'Hide Tooltips' : 'Show Tooltips';
  if (document.querySelector('#logfile_chart_section').style?.display === 'block') {
    document.querySelector('#show_chart_button').click();
    document.querySelector('#show_chart_button').click();
  }
  if (document.querySelector('#logfile_split_section').style?.display === 'block') {
    document.querySelector('#show_split_button').click();
    document.querySelector('#show_split_button').click();
  }
  if (document.querySelector('#logfile_minisplit_section').style?.display === 'block') {
    document.querySelector('#show_minisplit_button').click();
    document.querySelector('#show_minisplit_button').click();
  }
});

const logData = {};
let switching = false;

// Function to re-draw Log File details when a new log is selected
const selectLog = (filename) => {
  if (!filename || !Object.keys(logData).includes(filename)) return;
  const selectedData = logData[filename];
  console.log(filename, selectedData);
  document.querySelector('#log_nodename').textContent = logData[filename].nodename ?? 'Unknown';
  document.querySelector('#log_date').textContent = logData[filename].date ?? 'Unknown';
  document.querySelector('#log_sysname').textContent = logData[filename].sysname ?? 'Unknown';
  document.querySelector('#log_machine').textContent = logData[filename].machine ?? 'Unknown';
  document.querySelector('#log_release').textContent = logData[filename].release ?? 'Unknown';
  document.querySelector('#log_cpus').textContent = logData[filename]['number-of-cpus'] ?? 'Unknown';
  document.querySelector('#log_entry_count').textContent = logData[filename].statistics.length ?? 'Unknown';
  document.querySelector('#logfile_data_section').style.display = 'block';

  if (document.querySelector('#logfile_chart_section').style?.display === 'block') {
    switching = true;
    document.querySelector('#show_chart_button').click();
    switching = false;
  }
  if (document.querySelector('#logfile_split_section').style?.display === 'block') {
    switching = true;
    document.querySelector('#show_split_button').click();
    switching = false;
  }
  if (document.querySelector('#logfile_minisplit_section').style?.display === 'block') {
    switching = true;
    document.querySelector('#show_minisplit_button').click();
    switching = false;
  }
};

// Function to re-draw log file select options
const updateLogData = () => {
  const logFileNames = Object.keys(logData);
  if (!logFileNames.length) return;
  const options = logFileNames.map(file => {
    const option = document.createElement('option');
    option.value = file;
    option.textContent = file;
    return option;
  });
  const elSelectLog = document.querySelector('#selected_log');
  elSelectLog.replaceChildren(...options);
  elSelectLog.selectedIndex = 0;
  selectLog(logFileNames[0]);
};

// Function to update global logData object with newly parsed data
const parseLogData = (filename, data) => {
  console.log(`Parsing: ${filename}`);

  if (!data.sysstat) return console.log('Not a known log file, skipping...');

  const host = data.sysstat?.hosts?.[0];
  if (!host) return console.log('No host found in log data, skipping...');

  logData[filename] = host;
  localStorage.setItem('logData', JSON.stringify(logData));
};

// Helper function to promisify FileReader
const loadFileReader = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', (event) => {
      resolve(event.target.result);
    });
    reader.addEventListener('error', (error) => {
      reject(error);
    });
    reader.readAsText(file);
  });
}

// Load saved logs from localStorage at startup
window.addEventListener('DOMContentLoaded', () => {
  try {
    const localLogData = JSON.parse(localStorage.getItem('logData'));
    if (!localLogData || typeof localLogData !== 'object') return;
    for (const filename of Object.keys(localLogData)) {
      logData[filename] = localLogData[filename];
    }
    updateLogData();
  } catch (error) {
    console.log('Error reading from localStorage:', error);
    localStorage.setItem('logData', '{}');
  }
});

// Handle "Reset Saved Data" button
document.querySelector('#reset_saved_data').addEventListener('click', () => {
  const conf = confirm('Are you sure you want to remove all stored data?');
  if (!conf) return;
  localStorage.removeItem('logData');
  location.reload();
});

// Handle "Upload" button
document.querySelector('#upload_button').addEventListener('click', async () => {
  const elFileInput = document.querySelector('input[type="file"]');
  if (!elFileInput.files?.length) return console.log('No files selected.');
  const formData = new FormData();
  for (const file of elFileInput.files) {
    formData.append('files', file, file.name);
  }

  try {
    const req = await fetch('/upload', {
      method: 'POST',
      body: formData
    });
    const files = await req.json();
    for (const file of files) {
      if (file.status === 'success') {
        parseLogData(file.filename, file.data);
      }
    }
    updateLogData();
  } catch (error) {
    console.log('error', error);
  }
});

// Handle "Parse Locally" button
document.querySelector('#local_button').addEventListener('click', async () => {
  const elFileInput = document.querySelector('input[type="file"]');
  if (!elFileInput.files?.length) return console.log('No files selected.');
  for (const file of elFileInput.files) {
    try {
      const raw = await loadFileReader(file);
      const data = JSON.parse(raw);
      parseLogData(file.name, data);
    } catch (error) {
      console.log('error', error);
    }
  }
  updateLogData();
});

// Event handler for log file select input
document.querySelector('#selected_log').addEventListener('change', (event) => {
  if (!event.target.value) return;
  selectLog(event.target.value);
});

// Handle "Delete" button
document.querySelector('#delete_selected_data').addEventListener('click', () => {
  const elSelectLog = document.querySelector('#selected_log');
  const conf = confirm('Are you sure you want to remove the selected data?');
  if (!conf || !elSelectLog.value) return;
  console.log(`Deleting: ${elSelectLog.value}`);
  delete logData[elSelectLog.value];
  localStorage.setItem('logData', JSON.stringify(logData));
  updateLogData();
});

// Handle "Export as CSV" button
document.querySelector('#export_csv_button').addEventListener('click', () => {
  const filename = document.querySelector('#selected_log').value || null;
  const selectedData = logData[filename] || null;
  if (!selectedData) return;

  console.log('exporting', selectedData);
  // Build header for array of rows
  const headerRow = ['Time'];
  const cpuNames = selectedData.statistics?.[0]?.['cpu-load'].map(c => c.cpu);
  for (const cpu of cpuNames) {
    headerRow.push(`CPU ${cpu === 'all' ? 'All' : Number(cpu) + 1}`);
  }
  const rows = [headerRow];

  // Add each statistics entry to array of rows
  for (const entry of selectedData.statistics) {
    const entryRow = [entry.timestamp];
    for (const cpu of entry['cpu-load']) {
      entryRow.push(100 - cpu.idle);
    }
    rows.push(entryRow);
  }

  // Build CSV content from array of rows
  const csvContent = `# Linux sysstats data parsed on ${(new Date()).toLocaleDateString()}\n`
      + `# Name: ${selectedData.nodename}\n`
      + `# Log Date: ${selectedData.date}\n`
      + `# System: ${selectedData.sysname} ${selectedData.machine} ${selectedData.release}\n`
      + `# CPU Count: ${selectedData['number-of-cpus']}\n`
      + '\n' + rows.map(r => r.join(',')).join('\n');

  // Downlod CSV file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.visibility = 'hidden';
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename.substring(0, filename.length - 5)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});


// *** Handle "Show Line Chart" button
let chartContext;
document.querySelector('#show_chart_button').addEventListener('click', (event) => {
  const elSection = document.querySelector('#logfile_chart_section');
  if (!switching && event.target.value === 'Hide Line Chart') {
    event.target.value = 'Show Line Chart';
    elSection.style.display = 'none';
    return;
  }

  // Hide Split Chart if open
  const elSplitBtn = document.querySelector('#show_split_button');
  if (elSplitBtn.value === 'Hide Split Chart') {
    elSplitBtn.click();
  }

  // Hide Mini Split Chart if open
  const elMiniSplitBtn = document.querySelector('#show_minisplit_button');
  if (elMiniSplitBtn.value === 'Hide Mini Split Chart') {
    elMiniSplitBtn.click();
  }

  const filename = document.querySelector('#selected_log').value || null;
  const selectedData = logData[filename] || null;
  if (!selectedData) return;

  // Determine first/last dates
  const firstTime = selectedData.statistics?.[0].timestamp;
  const lastTime = selectedData.statistics?.[selectedData.statistics.length - 1].timestamp;
  const startDate = new Date(`${selectedData.date} ${firstTime}`);
  const endDate = new Date(`${selectedData.date} ${lastTime}`);
  document.querySelector('#start_date').textContent = startDate.toString();
  document.querySelector('#end_date').textContent = endDate.toString();

  // Build data set
  const data = selectedData.statistics.map(s => {
    const entry = {
      time: s.timestamp,
    };
    for (const log of s['cpu-load']) {
      if (log.cpu === 'all') continue;
      entry[`CPU ${Number(log.cpu) + 1}`] = 100 - log.idle;
    }
    return entry;
  });

  // Add chart data
  const colors = [...baseColors];
  // let c;
  const datasets = Object.keys(data[0]).filter(k => k !== 'time').map(k => ({
    label: k,
    data: data.map(i => i[k]),
    // fill: {
    //   target: 'origin',
    //   above: c = colors.shift(),
    // },
    tension: 0.4,
    // borderColor: c
    borderColor: colors.shift(),
  }));
  // console.log('datasets', datasets);

  const ctx = document.getElementById('log_chart').getContext('2d');
  if (chartContext) chartContext.destroy();
  chartContext = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(i => i.time),
      datasets,
    },
    options: {
      events: showToolTips ? ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'] : [],
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
      },
    },
    // Add white background to canvas for copying/saving image
    plugins: [{
      id: 'bg1',
      afterRender: (c) => {
        const ctx = c.ctx;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.restore();
      }
    }]
  });
  event.target.value = 'Hide Line Chart';
  elSection.style.display = 'block';
});


// *** Handle "Show Split Chart" button
let splitChartContexts = {};
document.querySelector('#show_split_button').addEventListener('click', (event) => {
  const elSection = document.querySelector('#logfile_split_section');
  if (!switching && event.target.value === 'Hide Split Chart') {
    event.target.value = 'Show Split Chart';
    elSection.style.display = 'none';
    return;
  }

  // Hide Line Chart if open
  const elChartBtn = document.querySelector('#show_chart_button');
  if (elChartBtn.value === 'Hide Line Chart') {
    elChartBtn.click();
  }

  // Hide Mini Split Chart if open
  const elMiniSplitBtn = document.querySelector('#show_minisplit_button');
  if (elMiniSplitBtn.value === 'Hide Mini Split Chart') {
    elMiniSplitBtn.click();
  }

  const filename = document.querySelector('#selected_log').value || null;
  const selectedData = logData[filename] || null;
  if (!selectedData) return;

  // Determine first/last dates
  const firstTime = selectedData.statistics?.[0].timestamp;
  const lastTime = selectedData.statistics?.[selectedData.statistics.length - 1].timestamp;
  const startDate = new Date(`${selectedData.date} ${firstTime}`);
  const endDate = new Date(`${selectedData.date} ${lastTime}`);
  document.querySelector('#split_start_date').textContent = startDate.toString();
  document.querySelector('#split_end_date').textContent = endDate.toString();

  // Build data set
  const data = selectedData.statistics.map(s => {
    const entry = {
      time: s.timestamp,
    };
    for (const log of s['cpu-load']) {
      if (log.cpu === 'all') continue;
      entry[`CPU ${Number(log.cpu) + 1 < 10 ? '0' : ''}${Number(log.cpu) + 1}`] = 100 - log.idle;
    }
    return entry;
  });

  // Clear old chart canvases
  const elGroupContainer = document.querySelector('#minisplit_chart');
  elGroupContainer.replaceChildren();

  // Loop through each CPU and generate separate charts
  const cpuKeys = Object.keys(data[0]).filter(k => k !== 'time');
  const colors = [...baseColors];
  for (const [index, cpuKey] of cpuKeys.entries()) {
    // Build chart datasets
    let c;
    const datasets = [{
      label: cpuKey,
      data: data.map(i => i[cpuKey]),
      fill: {
        target: 'origin',
        above: c = colors.shift(),
      },
      borderColor: c,
      tension: 0.4,
      // borderColor: colors.shift(),
    }]
    // console.log('datasets', datasets);

    const elContainer = document.createElement('div');
    const elGroupContainer = document.querySelector('#split_chart');
    elContainer.className = 'split_chart_container';
    elGroupContainer.appendChild(elContainer);
    const elCanvas = document.createElement('canvas');
    elCanvas.id = cpuKey.replaceAll(' ', '');
    elCanvas.width = 400;
    elCanvas.height = 600;
    elContainer.appendChild(elCanvas);

    const ctx = document.getElementById(cpuKey.replaceAll(' ', '')).getContext('2d');
    if (splitChartContexts[cpuKey]) splitChartContexts[cpuKey].destroy();
    splitChartContexts[cpuKey] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(i => i.time),
        datasets,
      },
      options: {
        events: showToolTips ? ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'] : [],
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          xAxis: { display: false },
          yAxis: { min: 0, max: 100 },
        },
        plugins: {
          legend: {
            position: 'right',
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false,
        },
        elements: {
          point: {
            radius: 0,
            borderWidth: 0,
          }
        }
      },
      // Add white background to canvas for copying/saving image
      plugins: [{
        id: 'bg1',
        afterRender: (c) => {
          const ctx = c.ctx;
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.restore();
        }
      }]
    });
  }

  // Make split chart section visible
  event.target.value = 'Hide Split Chart';
  elSection.style.display = 'block';
});


// *** Handle "Show Mini Split Chart" button
let miniSplitChartContexts = {};
document.querySelector('#show_minisplit_button').addEventListener('click', (event) => {
  const elSection = document.querySelector('#logfile_minisplit_section');
  if (!switching && event.target.value === 'Hide Mini Split Chart') {
    event.target.value = 'Show Mini Split Chart';
    elSection.style.display = 'none';
    return;
  }

  // Hide Line Chart if open
  const elChartBtn = document.querySelector('#show_chart_button');
  if (elChartBtn.value === 'Hide Line Chart') {
    elChartBtn.click();
  }

  // Hide Split Chart if open
  const elSplitBtn = document.querySelector('#show_split_button');
  if (elSplitBtn.value === 'Hide Split Chart') {
    elSplitBtn.click();
  }

  const filename = document.querySelector('#selected_log').value || null;
  const selectedData = logData[filename] || null;
  if (!selectedData) return;

  // Determine first/last dates
  const firstTime = selectedData.statistics?.[0].timestamp;
  const lastTime = selectedData.statistics?.[selectedData.statistics.length - 1].timestamp;
  const startDate = new Date(`${selectedData.date} ${firstTime}`);
  const endDate = new Date(`${selectedData.date} ${lastTime}`);
  document.querySelector('#minisplit_start_date').textContent = startDate.toString();
  document.querySelector('#minisplit_end_date').textContent = endDate.toString();

  // Clear old chart canvases
  const elGroupContainer = document.querySelector('#minisplit_chart');
  elGroupContainer.replaceChildren();

  // Build data set
  const data = selectedData.statistics.map(s => {
    const entry = {
      time: s.timestamp,
    };
    for (const log of s['cpu-load']) {
      if (log.cpu === 'all') continue;
      entry[`CPU ${Number(log.cpu) + 1 < 10 ? '0' : ''}${Number(log.cpu) + 1}`] = 100 - log.idle;
    }
    return entry;
  });

  // Loop through each CPU and generate separate charts
  const cpuKeys = Object.keys(data[0]).filter(k => k !== 'time');
  const colors = [...baseColors];
  for (const [index, cpuKey] of cpuKeys.entries()) {
    // Build chart datasets
    let c;
    const datasets = [{
      label: cpuKey,
      data: data.map(i => i[cpuKey]),
      fill: {
        target: 'origin',
        above: c = colors.shift(),
      },
      borderColor: c,
      tension: 0.4,
      // borderColor: colors.shift(),
    }]
    // console.log('datasets', datasets);

    const elContainer = document.createElement('div');
    elContainer.className = 'minisplit_chart_container';
    elGroupContainer.appendChild(elContainer);
    const elCanvas = document.createElement('canvas');
    elCanvas.id = `mini-${cpuKey.replaceAll(' ', '')}`;
    elCanvas.width = 1200;
    elCanvas.height = 40;
    elContainer.appendChild(elCanvas);

    const ctx = document.getElementById(`mini-${cpuKey.replaceAll(' ', '')}`).getContext('2d');
    if (miniSplitChartContexts[cpuKey]) miniSplitChartContexts[cpuKey].destroy();
    miniSplitChartContexts[cpuKey] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(i => i.time),
        datasets,
      },
      options: {
        events: showToolTips ? ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'] : [],
        responsive: false,
        maintainAspectRatio: true,
        scales: {
          xAxis: { display: false },
          yAxis: { min: 0, max: 100 },
        },
        plugins: {
          legend: {
            position: 'right',
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false,
        },
        elements: {
          point: {
            radius: 0,
            borderWidth: 0,
          }
        }
      },
      // Add white background to canvas for copying/saving image
      plugins: [{
        id: 'bg1',
        afterRender: (c) => {
          const ctx = c.ctx;
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.restore();
        }
      }]
    });
  }

  // Make mini split chart section visible
  event.target.value = 'Hide Mini Split Chart';
  elSection.style.display = 'block';
});
