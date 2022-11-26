import {
  Component,
  OnInit,
  Input,
  OnChanges,
  ElementRef,
  EventEmitter,
  Output,
  ChangeDetectorRef,
  ViewChild
} from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { Calendar, CalendarOptions, mergeCalendarOptions, Day } from './airbnb-calendar.interface';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDate,
  getMonth,
  getYear,
  isToday,
  isSameMonth,
  format,
  addMonths,
  setDay,
  getDay,
  subDays,
  subMonths,
  isAfter,
  isBefore,
  setHours,
  isSameDay,
  setMinutes,
  setSeconds,
  parseISO,
  isValid
} from 'date-fns';

@Component({
  selector: 'airbnb-calendar',
  templateUrl: './airbnb-calendar.component.html',
  styleUrls: ['./airbnb-calendar.component.sass'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: AirbnbCalendarComponent, multi: true }]
})
export class AirbnbCalendarComponent implements ControlValueAccessor, OnInit, OnChanges {
  @Input() options!: CalendarOptions;
  @Input() isOpened: boolean = false;
  @Output() modelValue: EventEmitter<string> = new EventEmitter<string>();
  @Output() fromValue: EventEmitter<string | null> = new EventEmitter<string | null>();
  @Output() toValue: EventEmitter<string | null> = new EventEmitter<string | null>();

  @ViewChild("prev") prev: HTMLElement
  @ViewChild("next") next: HTMLElement

  private date: Date = new Date();
  private innerValue: string | null = null;

  calendar!: Calendar;
  calendarNext!: Calendar;
  fromToDate: { from: Date | null; to: Date | null } = { from: null, to: null };

  get value(): string | null {
    return this.innerValue;
  }

  set value(val: string | null) {
    this.innerValue = val;

    this.onChangeCallback(this.innerValue)
    this.onTouchedCallback()
  }

  get controlsStatus(): { from: boolean; to: boolean } {
    let from = true
    let to = true

    if (this.options.minYear && this.calendar.year <= this.options.minYear) {
      from = !(this.calendar.year < this.options.minYear || (this.calendar.year == this.options.minYear && this.calendar.month === 0))
    }

    if (this.options.maxYear && this.calendar.year >= this.options.maxYear) {
      to = !(this.calendar.year > this.options.maxYear || (this.calendar.year == this.options.maxYear && this.calendar.month === 11))
    }

    return {
      from,
      to
    };
  }

  writeValue(val: string | null): void {
    this.fromToDate.from = null
    this.fromToDate.to = null

    if (val) {
      const [startDate, endDate] = val.split(this.options.separator!)

      this.setDate(startDate)
      this.setDate(endDate)
    } else if (val === "") {
      this.selectDay()
      this.value = ""
    }

    this.innerValue = val;
  }

  setDate(val: string): void {
    const date = parseISO(val)

    if (isValid(date)) {
      const leftDay = this.calendar.days.findIndex(day => isSameDay(day.date, date))
      const rightDay = this.calendarNext.days.findIndex(day => isSameDay(day.date, date))

      if (leftDay !== -1) {
        this.selectDay(leftDay, "primary")
      } else if (rightDay !== -1) {
        this.selectDay(rightDay, "primary")
      }
    }
  }

  registerOnChange(fn: any): void {
    this.onChangeCallback = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouchedCallback = fn;
  }

  private onTouchedCallback: () => void = () => { };
  private onChangeCallback: (_: any) => void = () => { };

  constructor(private elementRef: ElementRef, public cd: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.options = mergeCalendarOptions(this.options);
    this.initCalendar();
  }

  ngOnChanges(): void {
    this.options = mergeCalendarOptions(this.options);
    this.initCalendar();
  }

  selectDay(index?: number, calendar?: 'primary' | 'secondary'): void {
    if (index) {
      const cal = calendar === 'primary' ? this.calendar : this.calendarNext;
      if (!this.fromToDate.from) {
        this.fromToDate.from = cal.days[index].date;
        const from = format(this.fromToDate.from as Date, this.options.format as string);
        this.value = from;
        this.modelValue.next(from);
        this.fromValue.next(from);
      } else if (this.fromToDate.from && !this.fromToDate.to) {
        this.fromToDate.to = cal.days[index].date;

        let from = format(this.fromToDate.from as Date, this.options.format as string);
        let to = format(this.fromToDate.to as Date, this.options.format as string);

        if (isAfter(this.fromToDate.from, this.fromToDate.to)) {
          from = format(this.fromToDate.to as Date, this.options.format as string);
          to = format(this.fromToDate.from as Date, this.options.format as string);
        }

        this.value = `${from}${this.options.separator!}${to}`;
        this.modelValue.next(this.value);
        this.toValue.next(this.value);

        if (this.options.closeOnSelected) {
          this.isOpened = false;
        }
      } else if (this.fromToDate.to) {
        this.fromToDate = { from: cal.days[index].date, to: null };
        const from = format(this.fromToDate.from as Date, this.options.format as string);
        this.value = from;
        this.modelValue.next(from);
        this.fromValue.next(from);
      }
    }

    this.calendar.days = this.calendar.days.map((d: Day) => {
      return {
        ...d,
        ...{
          isIncluded: this.isIncluded(d.date),
          isActive: this.isActive(d)
        }
      };
    });

    this.calendarNext.days = this.calendarNext.days.map((d: Day) => {
      return {
        ...d,
        ...{
          isIncluded: this.isIncluded(d.date),
          isActive: this.isActive(d)
        }
      };
    });
  }

  nextMonth(): void {
    this.date = addMonths(this.date, 1);
    this.initCalendar();
    this.selectDay();
  }

  prevMonth(): void {
    this.date = subMonths(this.date, 1);
    this.initCalendar();
    this.selectDay();
  }

  private initCalendar(): void {
    const date = new Date(this.date.getTime());
    this.calendar = this.generateCalendar(date);
    this.calendarNext = this.generateCalendar(addMonths(date, 1));
  }

  private generateCalendar(date: Date = new Date()): Calendar {
    const [start, end, now] = [
      setHours(startOfMonth(date), 0),
      setHours(endOfMonth(date), 0),
      setSeconds(setMinutes(setHours(new Date(), 0), 0), 0)
    ];
    const days: Day[] = eachDayOfInterval({ start, end })
      .map(d => {
        d = setSeconds(setMinutes(setHours(d, 0), 0), 0);

        return {
          date: d,
          day: getDate(d),
          month: getMonth(d),
          year: getYear(d),
          isSameMonth: isSameMonth(d, start),
          isToday: isToday(d),
          isSelectable: true,
          isSelected: false,
          isVisible: true,
          isIncluded: this.isIncluded(d),
          isActive: false
        };
      })
      .reduce((acc: Day[], curr: Day, index: number, arr: Day[]) => {
        const first = this.options.firstCalendarDay || 0;
        const tmp = getDay(start) - first;

        if (tmp > 0 && arr.length - 1 === index) {
          acc.unshift(
            ...[...new Array(tmp)].map((_, i) => {
              const curr = setSeconds(setMinutes(setHours(subDays(start, i + 1), 0), 0), 0);
              return {
                date: curr,
                day: getDate(curr),
                month: getMonth(curr),
                year: getYear(curr),
                isSameMonth: false,
                isToday: false,
                isSelectable: false,
                isSelected: false,
                isVisible: true,
                isIncluded: this.isIncluded(curr),
                isActive: false
              };
            })
          );
        }

        return acc.concat(curr);
      }, [])
      .sort((a, b) => (a.date >= b.date ? 1 : -1));

    const dayNames = [];
    const dayStart = this.options.firstCalendarDay || 0;
    for (let i = dayStart; i <= 6 + dayStart; i++) {
      const date = setDay(new Date(), i);
      dayNames.push(format(date, this.options.formatDays || 'eeeeee', { locale: this.options.locale }));
    }

    return {
      month: getMonth(date),
      year: getYear(date),
      title: format(date, this.options.formatTitle || 'MMMM uuuu', { locale: this.options.locale }),
      days,
      dayNames
    };
  }

  isIncluded(date: Date): boolean {
    if (this.fromToDate.from && this.fromToDate.to) {
      if (isAfter(this.fromToDate.to, this.fromToDate.from)) {
        return isAfter(date, this.fromToDate.from) && isBefore(date, this.fromToDate.to)
      }

      return isBefore(date, this.fromToDate.from) && isAfter(date, this.fromToDate.to)
    }

    return false
  }

  isActive(day: Day): boolean {
    if (this.fromToDate.from || this.fromToDate.to) {
      if (this.fromToDate.from && this.fromToDate.to) {
        return isSameDay(this.fromToDate.from, day.date) || isSameDay(this.fromToDate.to, day.date)
      }

      if (this.fromToDate.from) {
        return isSameDay(this.fromToDate.from, day.date)
      }

      return isSameDay(this.fromToDate.to!, day.date)
    }
    
    return false
  }
}
