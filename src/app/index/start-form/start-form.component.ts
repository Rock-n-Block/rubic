import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  AfterContentInit,
  ViewChild,
  Output,
} from '@angular/core';
import { Web3Service } from '../../services/web3/web3.service';
import BigNumber from 'bignumber.js';
import { Router } from '@angular/router';

import { ContractsService } from '../../services/contracts/contracts.service';
import * as moment from 'moment';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  MatDatepicker,
  MatDialog,
} from '@angular/material';
import {
  MAT_MOMENT_DATE_ADAPTER_OPTIONS,
  MomentDateAdapter,
} from '@angular/material-moment-adapter';

import { MODE } from '../../app-routing.module';

export interface IContractDetails {
  base_address?: string;
  quote_address?: string;
  base_limit?: string;
  quote_limit?: string;
  stop_date?: number;
  owner_address?: string;
  public?: boolean | undefined;
  unique_link?: string;
  unique_link_url?: string;
  eth_contract?: any;

  broker_fee: boolean;
  broker_fee_address: string;
  broker_fee_base: number;
  broker_fee_quote: number;

  tokens_info?: {
    base: {
      token: any;
      amount: string;
    };
    quote: {
      token: any;
      amount: string;
    };
  };

  whitelist?: any;
  whitelist_address?: any;
  min_base_wei?: any;
  memo_contract?: any;
  min_quote_wei?: any;
}
export const MY_FORMATS = {
  useUtc: true,
  parse: {
    dateInput: 'LL',
  },
  display: {
    dateInput: 'DD.MM.YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'X',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
  selector: 'app-start-form',
  templateUrl: './start-form.component.html',
  styleUrls: ['./start-form.component.scss'],
  providers: [
    {
      provide: DateAdapter,
      useClass: MomentDateAdapter,
      deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS],
    },
    { provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
  ],
})
export class StartFormComponent implements OnInit, OnDestroy, AfterContentInit {
  @Output() BaseTokenCustom = new EventEmitter<any>();
  @Output() QuoteTokenCustom = new EventEmitter<any>();
  constructor(
    protected contractsService: ContractsService,
    private web3Service: Web3Service,
    protected router: Router,
  ) {
    this.sendData = {
      contract_type: 20,
      network: 1,
    };
    this.tokensData = {
      base: {
        token: {},
        customToken: false,
      },
      quote: {
        token: {},
        customToken: false,
      },
    };
    this.isAdvSettingsOpen = false;
    this.openedCustomTokens = {
      base: false,
      quote: false,
    };

    this.customTokens = {
      base: {},
      quote: {},
    };

    this.minDate = moment().add(1, 'hour');
    const startDateTime = moment(this.minDate);

    this.datePickerDate = startDateTime.add(1, 'week');
    this.datePickerTime = `${startDateTime.hour()}:${startDateTime.minutes()}`;
  }
  public tokensData;
  public isAdvSettingsOpen;

  public minTime;
  public minDate: moment.Moment;

  public datePickerDate;
  public datePickerTime;

  public customTokens;

  public openedCustomTokens: {
    base: boolean;
    quote: boolean;
  };

  public quoteTokenChanger = new EventEmitter<any>();
  public baseTokenChanger = new EventEmitter<any>();

  public requestData: IContractDetails;

  protected sendData;

  public formIsSending: boolean;

  @ViewChild('startForm') public startForm;

  public changedToken() {
    localStorage.setItem(
      'form_new_values',
      JSON.stringify({ tokens_info: this.tokensData }),
    );
  }
  public checkRate(revert?) {
    if (!(this.tokensData.base.token && this.tokensData.quote.token)) {
      return false;
    }
    const baseCoinAmount = new BigNumber(this.tokensData.base.amount).div(
      Math.pow(10, this.tokensData.base.token.decimals),
    );

    const quoteCoinAmount = new BigNumber(this.tokensData.quote.amount).div(
      Math.pow(10, this.tokensData.quote.token.decimals),
    );

    return !revert
      ? baseCoinAmount.div(quoteCoinAmount).dp(4)
      : quoteCoinAmount.div(baseCoinAmount).dp(4);
  }

  public toogleShowCustomToken(type) {
    this.tokensData[type].customToken = !this.tokensData[type].customToken;
  }
  public toogleAdvSettings() {
    this.isAdvSettingsOpen = !this.isAdvSettingsOpen;
  }

  ngOnInit() {
    const draftData = localStorage.getItem('form_new_values');
    this.requestData = draftData
      ? JSON.parse(draftData)
      : {
          tokens_info: {
            base: {
              token: {},
            },
            quote: {
              token: {},
            },
          },
        };

    this.requestData.public = true;
  }

  ngOnDestroy(): void {
    this.changedToken();
  }

  ngAfterContentInit() {
    console.log(this.startForm);
    setTimeout(() => {
      this.setFullDateTime();
    });
  }
  public dateChange() {
    if (this.startForm.value.active_to.isSame(this.minDate, 'day')) {
      this.minTime = `${this.minDate.hour()}:${this.minDate.minutes()}`;
    } else {
      this.minTime = null;
    }
    this.setFullDateTime();
  }
  public timeChange() {
    this.setFullDateTime();
  }

  private setFullDateTime() {
    const times = this.startForm.value.time.split(':');
    this.startForm.value.active_to.hour(times[0]);
    this.startForm.value.active_to.minutes(times[1]);

    if (this.startForm.value.active_to.isBefore(this.minDate)) {
      this.startForm.controls.time.setErrors({ incorrect: true });
    } else {
      this.startForm.controls.time.setErrors(null);
    }
    setTimeout(() => {
      this.requestData.stop_date = this.startForm.value.active_to.clone();
    });
  }

  public setCustomToken(field, token) {
    this.customTokens[field] = token;
  }

  public addCustomToken(name) {
    this.requestData.tokens_info[name].token = { ...this.customTokens[name] };
    switch (name) {
      case 'base':
        this.BaseTokenCustom.emit(this.requestData.tokens_info[name]);
        break;
      case 'quote':
        this.QuoteTokenCustom.emit(this.requestData.tokens_info[name]);
        break;
    }
    this.openedCustomTokens[name] = false;
  }

  public createContract() {
    this.sendData.stop_date = this.startForm.value.active_to
      .clone()
      .utc()
      .format('YYYY-MM-DD HH:mm');

    this.sendData.base_limit = this.requestData.tokens_info.base.amount;
    this.sendData.quote_limit = this.requestData.tokens_info.quote.amount;

    this.sendData.name =
      this.requestData.tokens_info.base.token.token_short_name +
      '<>' +
      this.requestData.tokens_info.quote.token.token_short_name;

    this.sendData.base_address = this.requestData.tokens_info.base.token.address;
    this.sendData.quote_address = this.requestData.tokens_info.quote.token.address;

    this.sendData.base_coin_id = this.requestData.tokens_info.base.token.mywish_id;
    this.sendData.quote_coin_id = this.requestData.tokens_info.quote.token.mywish_id;

    this.sendData.public = this.requestData.public;

    this.sendData.notification = false;

    console.log(this.sendData, this.requestData);

    this.sendContractData(this.sendData);
  }

  protected sendContractData(data) {
    if (this.formIsSending) {
      return;
    }
    this.formIsSending = true;

    if (window['dataLayer']) {
      window['dataLayer'].push({ event: 'publish' });
    }

    this.contractsService[data.id ? 'updateSWAP3' : 'createSWAP3'](data)
      .then(
        (result) => {
          this.contractIsCreated(result);
        },
        (err) => {
          console.log(err);
        },
      )
      .finally(() => {
        this.formIsSending = false;
      });
  }

  private contractIsCreated(contract) {
    this.router.navigate(['/public-v3/' + contract.unique_link]);
  }
}
