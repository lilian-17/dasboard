const { 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addDays, format
} = require('date-fns');

/**
 * Comprehensive test of MiniMonth grid calculation and class logic
 */

// Test 1: Grid calculation for various months
console.log('=== TEST 1: Grid Calculations ===\n');

const testMonths = [
  new Date(2026, 0, 15),  // Jan 2026 (starts on Thu)
  new Date(2026, 1, 15),  // Feb 2026 (starts on Sun)
  new Date(2026, 4, 15),  // May 2026 (starts on Fri)
  new Date(2026, 11, 15), // Dec 2026 (starts on Tue)
];

testMonths.forEach(viewingMonth => {
  const monthStart = startOfMonth(viewingMonth);
  const monthEnd = endOfMonth(viewingMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  
  console.log(`${format(viewingMonth, 'MMMM yyyy')}:`);
  console.log(`  Month: ${format(monthStart, 'MMM dd')} - ${format(monthEnd, 'MMM dd')}`);
  console.log(`  Grid:  ${format(gridStart, 'MMM dd')} - ${format(gridEnd, 'MMM dd')}`);
  console.log(`  Days:  ${days.length} (${days.length / 7} weeks)`);
  console.log(`  Complete weeks? ${days.length % 7 === 0 ? 'YES' : 'NO'}`);
  console.log('');
});

// Test 2: Class application logic
console.log('\n=== TEST 2: Class Application ===\n');

const viewingMonth = new Date(2026, 4, 15); // May 2026
const today = new Date(2026, 4, 21);        // May 21, 2026
const currentWeekStart = new Date(2026, 4, 18); // Mon May 18
const weekEnd = addDays(currentWeekStart, 6);   // Sun May 24

const monthStart = startOfMonth(viewingMonth);
const monthEnd = endOfMonth(viewingMonth);
const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

console.log(`Viewing month: May 2026`);
console.log(`Current week: ${format(currentWeekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd')}`);
console.log(`Today: ${format(today, 'MMM dd')}`);
console.log('');

// Test specific dates
const testDates = [
  new Date(2026, 3, 27), // Apr 27 - out of month, before week
  new Date(2026, 3, 30), // Apr 30 - out of month, before week
  new Date(2026, 4, 1),  // May 1 - in month, before week
  new Date(2026, 4, 18), // May 18 - in month, in week (start), not today
  new Date(2026, 4, 21), // May 21 - in month, in week, TODAY
  new Date(2026, 4, 24), // May 24 - in month, in week (end), not today
  new Date(2026, 4, 25), // May 25 - in month, after week
  new Date(2026, 4, 31), // May 31 - in month, after week
];

testDates.forEach(day => {
  const inMonth = isSameMonth(day, viewingMonth);
  const isToday = isSameDay(day, today);
  const inWeek = day >= currentWeekStart && day <= weekEnd;
  
  const classes = [
    'mini-day',
    !inMonth ? 'out-of-month' : '',
    inWeek ? 'in-week' : '',
    isToday ? 'is-today' : '',
  ].filter(Boolean).join(' ');
  
  console.log(`${format(day, 'yyyy-MM-dd (EEE)')}:`);
  console.log(`  inMonth=${inMonth}, inWeek=${inWeek}, isToday=${isToday}`);
  console.log(`  classes="${classes}"`);
  console.log('');
});

// Test 3: Key stability
console.log('\n=== TEST 3: Key Stability ===\n');

const testKeysMonth = new Date(2026, 2, 15); // March 2026 (has DST in Europe)
const testMonthStart = startOfMonth(testKeysMonth);
const testMonthEnd = endOfMonth(testKeysMonth);
const testGridStart = startOfWeek(testMonthStart, { weekStartsOn: 1 });
const testGridEnd = endOfWeek(testMonthEnd, { weekStartsOn: 1 });
const testDays = eachDayOfInterval({ start: testGridStart, end: testGridEnd });

console.log('Keys for March 2026 (contains DST):');
testDays.slice(0, 7).forEach((day, i) => {
  const key1 = day.toISOString();
  const key2 = day.toISOString(); // Call again to check consistency
  const match = key1 === key2 ? 'MATCH' : 'DIFFER';
  console.log(`  Day ${i+1}: ${key1} [${match}]`);
});

// Test 4: Grid fills correctly for all months
console.log('\n\n=== TEST 4: Grid Completeness ===\n');

let allComplete = true;
for (let month = 0; month < 12; month++) {
  const testMonth = new Date(2026, month, 15);
  const ms = startOfMonth(testMonth);
  const me = endOfMonth(testMonth);
  const gs = startOfWeek(ms, { weekStartsOn: 1 });
  const ge = endOfWeek(me, { weekStartsOn: 1 });
  const dayList = eachDayOfInterval({ start: gs, end: ge });
  
  const isComplete = dayList.length % 7 === 0;
  if (!isComplete) {
    console.log(`❌ ${format(testMonth, 'MMM yyyy')}: ${dayList.length} days (not a complete week count)`);
    allComplete = false;
  }
}

if (allComplete) {
  console.log('✓ All months have complete weeks in their grid');
}

