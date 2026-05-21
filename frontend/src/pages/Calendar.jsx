import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import {
  format, parseISO, isSameDay, isSameMonth,
  addDays, addWeeks, addMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, getHours, getMinutes,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import './Calendar.css';

const HOUR_START = 7;
const HOUR_END = 22;
const TOTAL_HOURS = HOUR_END - HOUR_START; // 15

function formatEventTime(event) {
  const start = event.start?.dateTime;
  const end = event.end?.dateTime;
  if (!start) return 'Toute la journée';
  const s = format(parseISO(start), 'H:mm');
  const e = end ? format(parseISO(end), 'H:mm') : null;
  return e ? `${s} – ${e}` : s;
}

function getEventPosition(event) {
  const startStr = event.start?.dateTime;
  const endStr = event.end?.dateTime;
  if (!startStr) return null;

  const startDate = parseISO(startStr);
  const startHour = getHours(startDate) + getMinutes(startDate) / 60;

  let endHour;
  if (endStr) {
    const endDate = parseISO(endStr);
    endHour = isSameDay(startDate, endDate)
      ? getHours(endDate) + getMinutes(endDate) / 60
      : HOUR_END;
  } else {
    endHour = startHour + 1;
  }

  const clampedStart = Math.max(HOUR_START, Math.min(HOUR_END, startHour));
  if (clampedStart >= HOUR_END) return null;

  let clampedEnd = Math.max(clampedStart + 0.25, Math.min(HOUR_END, endHour));
  clampedEnd = Math.min(HOUR_END, clampedEnd);

  return {
    top: (clampedStart - HOUR_START) / TOTAL_HOURS * 100,
    height: (clampedEnd - clampedStart) / TOTAL_HOURS * 100,
  };
}
