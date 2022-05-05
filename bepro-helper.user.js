// ==UserScript==
// @name        BePro Global Export
// @namespace   https://issta.beprotravel.com/
// @version     1.0
// @description This userscript send help to fill some order information in external systems
// @author      Misha Kav
// @copyright   2017, Misha Kav by BePro Travel LTD.
// @icon        https://ofisstaakim.beprotravel.net/favicon.ico
// @icon64      https://issta.beprotravel.com/favicon.ico
// @homepage    https://issta.beprotravel.com/
// @downloadURL
// @require      file:///Users/misha/Downloads/GithubSamples/userscripts/bepro-helper.user.js
// @match       *://issta.beprotravel.com/*
// @match       *.travelbooster.com/*
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_registerMenuCommand
// @grant       GM_unregisterMenuCommand
// @run-at      document-end
// ==/UserScript==

(function () {
  'use strict';
  // for local debug
  // @require      file:///Users/misha/Downloads/GithubSamples/userscripts/bepro-helper.user.js

  // ===== UTILS =====
  const isBeProSite = () => location.href.includes('beprotravel');
  const isTravelBoosterSite = () => location.href.includes('travelbooster');
  const isTransactionPage = () =>
    location.href.includes('EditTransaction.aspx');
  const isEmptyObject = (obj) =>
    obj == null ||
    (obj && obj.constructor === Object && Object.keys(obj).length === 0);
  const isNotEmptyObject = (obj) => !isEmptyObject(obj);
  const getQueryStringByName = (name, url) => {
    if (!url) {
      url = window.location.href;
    }

    name = name.replace(/[\[\]]/g, '\\$&');

    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    const results = regex.exec(url);

    if (!results) {
      return null;
    }

    if (!results[2]) {
      return '';
    }

    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  };
  // ===== UTILS =====

  let _Order;
  const TIMEOUT = 400;
  let _CommandId;

  const SUPPLIERS = {
    gogb: 'GO GLOBAL TRAVEL',
    ean1: 'EXPEDIA',
    ean2: 'EXPEDIA',
    ean7: 'EXPEDIA',
  };

  const STATUSES = {
    OK: 'OK',
    RQ: 'Request',
    SO: 'SoldOut',
    XX: 'CancelledWithNoConfirm',
    CX: 'CancelledWithConfirm',
  };

  init();

  function init() {
    initBeProSite();
    initTravelBooster();

    loadOrderFromStorage();
    if (isNotEmptyObject(_Order)) {
      const { OrderSegId } = _Order;

      // GM_registerMenuCommand(`Load Order #${OrderSegId}`, loadOrderFromStorage);
      GM_registerMenuCommand(`Hotel Details #${OrderSegId}`, fillHotelDetails);
    }
  }

  function initBeProSite() {
    if (isBeProSite() && $('#wid-id-myorders').length > 0) {
      $('#wid-id-myorders header span:first').after(
        "<button id='MakeLink' class='btn btn-xs btn-warning margin-top-5'>Make Link</button>"
      );

      $('#MakeLink').click(function () {
        if (isNotEmptyObject(NC.Widgets.B2B.MyOrdersWidget._CurrentOrder)) {
          _Order = NC.Widgets.B2B.MyOrdersWidget._CurrentOrder;
          //RegisterCommand(_Order.OrderRow.SegmentId);
          NC.Widgets.B2B.Utils.SmallSuccessBox(
            'Order Remembered Successfully: ' + _Order.OrderRow.SegmentId
          );

          makeTravelBoosterUrl();
        } else {
          NC.Widgets.B2B.Utils.SmallWarningBox(
            'Please, Select the Order first'
          );
        }
      });
    }
  }

  function makeTravelBoosterUrl() {
    if (isNotEmptyObject(_Order)) {
      const segment = _Order.Order.Segments[0];
      const miniOrder = {
        OrderSegId: segment.OrderSegId,
        SuppPnr: segment.SuppPnr,
        ItemDesc: segment.ItemDesc,
        ItemStarRateCode: segment.ItemStarRateCode,
        RoomsStatusCode: segment.RoomsStatusCode,
        CheckIn: segment.CheckIn,
        CheckOut: segment.CheckOut,
        RoomsFirstCXL: segment.RoomsFirstCXL,
        SysTotalGross: segment.SysTotalGross,
        SysTotalGross2: segment.SysTotalGross2,
        SysSuppCode: segment.SysSuppCode,
        SysBasisCode: segment.Rooms[0].SysBasisCode,
        SysCurrencyCode: segment.SysCurrencyCode,
        SysTotalGross2: segment.SysTotalGross2,
        NumberOfNights: segment.NumberOfNights,
        ItemAddress: segment.ItemAddress,
        SuppCityDesc: segment.SuppCityDesc,
        ItemPhone: segment.ItemPhone,
        ItemFax: segment.ItemFax,
        ItemZip: segment.ItemZip,
      };

      const queryString = `Order=${encodeURIComponent(
        JSON.stringify(miniOrder)
      )}`;

      $('#TravelBoosterUrl').remove();
      $('#MakeLink').after(
        `<a target='_blank' id='TravelBoosterUrl' 
          class='btn btn-xs btn-danger margin-top-5 margin-left10' 
          href='https://b2e-genesis-out.travelbooster.com/UI_NET/Services/Hotel/Index.aspx?${queryString}'>
          Travel Booster ${_Order.OrderRow.SegmentId}
         </a>`
      );
    } else {
      NC.Widgets.B2B.Utils.SmallWarningBox('Please, Select the Order first');
    }
  }

  function initTravelBooster() {
    if (isTravelBoosterSite()) {
      saveOrderFromQueryStringToStorage();
    }
  }

  function fillHotelDetails() {
    if (isTravelBoosterSite() && isNotEmptyObject(_Order)) {
      fillGeneralDetails();
      fillDates();
      fillReservation();
      fillAddress();

      setTimeout(showPricingTab, 1000);
    }
  }

  function showPricingTab() {
    jQuery('[id*=tabPassengers_A]').trigger(jQuery.Event('click'));
    addCurrency();
  }

  function AddPax() {
    jQuery('[id*=dlCustomers_ctl01_chkSelected]')
      .prop('checked', true)
      .trigger(jQuery.Event('change'));
    setTimeout(addCurrency, TIMEOUT);
  }

  function addPrice() {
    const { SysTotalGross, SysTotalGross2, OrderSegId } = _Order;

    jQuery('[id*=editCustomers_dlCustomers_ctl01_txtNet]')
      .val(SysTotalGross)
      .trigger(jQuery.Event('change'));
    jQuery('[id*=editCustomers_dlCustomers_ctl01_txtSellPrice]')
      .val(SysTotalGross2)
      .trigger(jQuery.Event('change'));

    alert(`Finish To Fill Order: #${OrderSegId}`);
  }

  function addCurrency() {
    const { SysCurrencyCode = 'ttt' } = _Order;

    jQuery('[id*=editCustomers_frmTransact_ddlCurrency]')
      .val(SysCurrencyCode)
      .trigger(jQuery.Event('change'));

    setTimeout(addPrice, TIMEOUT);
  }

  function saveOrderFromQueryStringToStorage() {
    const orderQueryString = getQueryStringByName('Order');

    if (isNotEmptyObject(orderQueryString)) {
      const decodeOrderString = decodeURIComponent(orderQueryString);
      _Order = JSON.parse(decodeOrderString);
      saveOrderToStorage();
      // fillHotelDetails();
    }
  }

  function fillGeneralDetails() {
    jQuery('[id*=tabControlMain_txtDesc]').val(_Order.ItemDesc);
    fillSupplier();
    fillDestination();
  }

  function fillSupplier() {
    jQuery('[id*=cbResSupp_Widget]').trigger(jQuery.Event('click'));
    const { SysSuppCode } = _Order;
    const supplierText = SUPPLIERS[SysSuppCode] ? SUPPLIERS[SysSuppCode] : null;

    if (supplierText) {
      setTimeout(() => {
        jQuery('[id*=HotelSuppliersWithDetails]')
          .find(`[text='${supplierText}']`)
          .trigger(jQuery.Event('click'));
      }, TIMEOUT);
    }
  }

  function fillDestination() {
    jQuery('[id*=cbAreas_tbAutoComplete]').val(_Order.SuppCityDesc);
  }

  function fillDates() {
    const { CheckIn, CheckOut } = _Order;
    const checkIn = new Date(CheckIn);
    const checkInDate = ('0' + checkIn.getDate()).slice(-2);
    const checkInMonth = ('0' + (checkIn.getMonth() + 1)).slice(-2);
    const checkInYear = checkIn.getFullYear();
    const checkInString = `${checkInDate}/${checkInMonth}/${checkInYear}`;
    const checkOut = new Date(CheckOut);
    const checkOutDate = ('0' + checkOut.getDate()).slice(-2);
    const checkOutMonth = ('0' + (checkOut.getMonth() + 1)).slice(-2);
    const checkOutYear = checkOut.getFullYear();
    const checkOutString = `${checkOutDate}/${checkOutMonth}/${checkOutYear}`;

    jQuery('[id*=frmDates_dsStartDate_hfDate]')
      .val(checkInString)
      .trigger('change');
    jQuery('[id*=frmDates_dsEndDate_hfDate]')
      .val(checkOutString)
      .trigger('change');
  }

  function fillReservation() {
    const { OrderSegId, SuppPnr } = _Order;

    fillStatus();
    jQuery('[id*=tabControlMain_txtConfWidth]').val(`BePro: ${OrderSegId}`);
    jQuery('[id*=G2DataForm4_txtReservation]').val(SuppPnr);
  }

  function fillStatus() {
    const { RoomsStatusCode } = _Order;
    const statusValue = STATUSES[RoomsStatusCode]
      ? STATUSES[RoomsStatusCode]
      : 'None';

    jQuery('[id*=G2DataForm4_ddlStatus]').val(statusValue);
  }

  function fillAddress() {
    const { ItemAddress, SuppCityDesc, ItemZip, ItemPhone, ItemFax } = _Order;

    jQuery('[id*=productAddress_tbAddress]').val(ItemAddress);
    jQuery('[id*=productAddress_tbCity]').val(SuppCityDesc);
    jQuery('[id*=productAddress_tbZip]').val(ItemZip);
    jQuery('[id*=G2DataForm1_txtPhone1]').val(ItemPhone);
    jQuery('[id*=tabControlMain_txtFax]').val(ItemFax);
  }

  function RegisterCommand(segmentId) {
    _CommandId = GM_registerMenuCommand(
      `Fill Order Info #${segmentId}`,
      fillOrderInfo
    );
  }

  function fillOrderInfo() {
    //console.log(_Order);
    GM_unregisterMenuCommand(_CommandId);
    SaveToStorage();
    NC.Widgets.B2B.Utils.SmallSuccessBox('Saved to storage');
  }

  function saveOrderToStorage() {
    if (isNotEmptyObject(_Order)) {
      GM_setValue('Order', JSON.stringify(_Order));
      // alert('Order Saved Successfully', _Order.OrderSegId);
    }
  }

  function loadOrderFromStorage() {
    const order = GM_getValue('Order');

    if (isNotEmptyObject(order)) {
      _Order = JSON.parse(order);
      // console.log('Load Order from Storage', _Order);
    }
  }
})();
