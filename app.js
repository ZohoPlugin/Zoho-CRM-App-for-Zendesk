(function() {

  return {

  	defaultState: 'loading_screen',

  	resources: {
  		ZOHOCRM_URL: 'https://crm.zoho.com'
  	},

    events: {
      'app.activated': 'activateApp',
      'app.willDestroy': 'destroyApp',
      'get_zcrm_contact_info.done': 'showContactInfo',
      'get_zcrm_contact_info.fail': 'handleFailure',
      'get_zcrm_lead_info.done': 'showLeadInfo',
      'get_zcrm_lead_info.fail': 'handleFailure',
      'get_zcrm_account_info.done': 'showAccountInfo',
      'get_zcrm_account_info.fail': 'handleFailure',
      'get_related_records.done': 'showRelatedRecords',
      'get_related_records.fail': 'handleSubTabFailure',
      'click .open-model': function() {
      	if (!this.$('#popupview-model').is(':visible')) {
      		// show popup if its not already open
      		this.$('#popupview-model').modal({'keyboard': true});
      	}
      },
      'show .popupview-model': function() {
      	if (this.crm_data.module === 'Contacts') {
      		var content1 = this.renderTemplate('contact_info', {'contact': this.crm_data});
      		this.$('.modal-body').html(content1);
      	}
      	else if (this.crm_data.module === 'Accounts') {
      		var content2 = this.renderTemplate('account_info', {'account': this.crm_data});
      		this.$('.modal-body').html(content2);
      	}
      	else {
      		var content3 = this.renderTemplate('lead_info', {'lead': this.crm_data});
      		this.$('.modal-body').html(content3);
      	}

      	// by default show details tab
      	this.switchSubTab('crm_fields');
      },
      'hide .popupview-model': function() {
      	this.$('.modal-body').html('');
      },
      'click .crm_fields': function() {
      	this.switchSubTab('crm_fields');
      },
      'click .notes': function() {
      	this.switchSubTab('notes', 'Notes');
      },
      'click .potentials': function() {
      	this.switchSubTab('potentials', 'Potentials');
      },
      'click .events': function() {
      	this.switchSubTab('events', 'Events');
      },
      'click .open-account': function() {
      	if (!this.$('#popupview-model').is(':visible')) {
      		this.switchTo('loading_screen');
      		this.fetchZCRMAccountInfo(this.crm_data.account_name.name);
      	}
      },
      'click .back_to_contact': function() {
      	this.switchTo('loading_screen');
      	this.fetchZCRMContactInfo(this.ticket().requester().email());
      }
    },

    activateApp: function() {
    	
    	this.$('.zcrm-header').attr('href', this.resources.ZOHOCRM_URL);

		var ticket = this.ticket();
		var requester = ticket.requester();
		this.email_id = requester.email();

		// to maintain zoho crm contact/lead data
		this.crm_data = {};

		this.fetchZCRMContactInfo(this.email_id);
	},

	destroyApp: function() {
		// reseting the zoho crm contact/lead data obj
		this.crm_data = {};
	},

	handleFailure: function() {
		this.switchTo('error_screen');
	},

	showContactInfo: function(data) {

		if (typeof(data.response.nodata) != 'undefined') {
			// No records matching in Contacts module, so going to find the same in Leads module.
			this.fetchZCRMLeadInfo(this.email_id);
		}
		else if (typeof(data.response.error) != 'undefined') {
			this.handleFailure();
		}
		else {
			var crm_fields = [];
			if (typeof(data.response.result.Contacts.row.length) != 'undefined' && data.response.result.Contacts.row.length > 1) {
				crm_fields = data.response.result.Contacts.row[0].FL;
			}
			else {
				crm_fields = data.response.result.Contacts.row.FL;
			}

			var crm_fields_json = {};
			_.each(crm_fields, function(crm_field) {
				crm_fields_json[crm_field.val] = crm_field.content;
			});

			var contact_name = {};
			contact_name.name = _.result(crm_fields_json, 'First Name', '') + ' ' + crm_fields_json['Last Name'];
			contact_name.link = helpers.fmt('%@/crm/EntityInfo.do?module=Contacts&id=%@', this.resources.ZOHOCRM_URL, crm_fields_json['CONTACTID']);
			contact_name.zdesk_userprofile_link = helpers.fmt('/agent/tickets/%@/requester/requested_tickets', this.ticket().id());
			//contact_name.photo = helpers.fmt('%@/crm/private/json/Contacts/downloadPhoto?authtoken='+this.setting('authtoken')+'&scope=crmapi&id=%@', this.resources.ZOHOCRM_URL, crm_fields_json['CONTACTID']);
			
			var has_account = _.has(crm_fields_json, 'Account Name');
			var account_name = {};
			if (has_account) {
				account_name.name = crm_fields_json['Account Name'];
				account_name.link = helpers.fmt('%@/crm/EntityInfo.do?module=Accounts&id=%@', this.resources.ZOHOCRM_URL, crm_fields_json['ACCOUNTID']);
			}
			
			var contact_owner = crm_fields_json['Contact Owner'];
			var contact_email = _.result(crm_fields_json, 'Email', '');
			var phone = _.result(crm_fields_json, 'Phone', '');
			var mobile = _.result(crm_fields_json, 'Mobile', '');
			var department = _.result(crm_fields_json, 'Department', '');

			var address = '';
			if (_.has(crm_fields_json, 'Mailing Street')) {
				address = address + crm_fields_json['Mailing Street'] + ', ';
			}
			if (_.has(crm_fields_json, 'Mailing City')) {
				address = address + crm_fields_json['Mailing City'] + ', ';
			}
			if (_.has(crm_fields_json, 'Mailing State')) {
				address = address + crm_fields_json['Mailing State'] + ', ';
			}
			if (_.has(crm_fields_json, 'Mailing Country')) {
				address = address + crm_fields_json['Mailing Country'] + ', ';
			}
			address = address.trim();
			address = (address.endsWith(',') ? address.substring(0, address.length-1) : address);
			if (_.has(crm_fields_json, 'Mailing Zip')) {
				address = address + ' - ' + crm_fields_json['Mailing Zip'];
			}

			var other_fields = [];
			var other_crm_fields = _.omit(crm_fields_json, 'Last Name', 'First Name', 'Account Name', 'Contact Owner', 'Email', 'Mobile', 'Department', 'Mailing Street', 'Mailing City', 'Mailing State', 'Mailing Country', 'Mailing Zip', 'MODIFIEDBY');
			_.each(other_crm_fields, function(field_value, field_name) {
				if (!field_name.endsWith('ID')) {
					other_fields.push({'key': field_name, 'val': field_value});
				}
			});
			if (address !== '') {
				other_fields.unshift({'key': 'Address', 'val': address});
			}
			if (department !== '') {
				other_fields.unshift({'key': 'Department', 'val': department});
			}
			if (contact_owner !== '') {
				other_fields.unshift({'key': 'Contact Owner', 'val': contact_owner});
			}

			var contact_info = {};
			contact_info.contact_name = contact_name;
			contact_info.has_account = has_account;
			contact_info.account_name = account_name;
			contact_info.contact_owner = contact_owner;
			contact_info.email = contact_email;
			contact_info.has_phone = (phone !== "");
			contact_info.phone = phone;
			contact_info.has_mobile = (mobile !== "");
			contact_info.mobile = mobile;
			contact_info.other_fields = other_fields;

			this.crm_data = contact_info;
			this.crm_data.module = 'Contacts';
			this.crm_data.rec_id = crm_fields_json['CONTACTID'];

			this.switchTo('contact_info', {'contact': contact_info});

			// by default showing crm fields
			this.switchSubTab('crm_fields', '');
		}
	},

	showLeadInfo: function(data) {
		if (typeof(data.response.nodata) != 'undefined') {
			this.switchTo('nodata_screen');
		}
		else if (typeof(data.response.error) != 'undefined') {
			this.switchTo('error_screen');
		}
		else {
			var crm_fields = [];
			if (typeof(data.response.result.Leads.row.length) != 'undefined' && data.response.result.Leads.row.length > 1) {
				crm_fields = data.response.result.Leads.row[0].FL;
			}
			else {
				crm_fields = data.response.result.Leads.row.FL;
			}

			var crm_fields_json = {};
			_.each(crm_fields, function(crm_field) {
				crm_fields_json[crm_field.val] = crm_field.content;
			});

			var lead_name = {};
			lead_name.name = _.result(crm_fields_json, 'First Name', '') + ' ' + crm_fields_json['Last Name'];
			lead_name.link = helpers.fmt('%@/crm/EntityInfo.do?module=Leads&id=%@', this.resources.ZOHOCRM_URL, crm_fields_json['LEADID']);
			lead_name.zdesk_userprofile_link = helpers.fmt('/agent/tickets/%@/requester/requested_tickets', this.ticket().id());
			//lead_name.photo = helpers.fmt('%@/crm/private/json/Leads/downloadPhoto?authtoken='+this.setting('authtoken')+'&scope=crmapi&id=%@', this.resources.ZOHOCRM_URL, crm_fields_json['LEADID']);
			
			var company = _.result(crm_fields_json, 'Company', '');
			var lead_owner = crm_fields_json['Lead Owner'];
			var lead_email = _.result(crm_fields_json, 'Email', '');
			var phone = _.result(crm_fields_json, 'Phone', '');
			var mobile = _.result(crm_fields_json, 'Mobile', '');
			var lead_status = _.result(crm_fields_json, 'Lead Status', '');

			var address = '';
			if (_.has(crm_fields_json, 'Street')) {
				address = address + crm_fields_json['Street'] + ', ';
			}
			if (_.has(crm_fields_json, 'City')) {
				address = address + crm_fields_json['City'] + ', ';
			}
			if (_.has(crm_fields_json, 'State')) {
				address = address + crm_fields_json['State'] + ', ';
			}
			if (_.has(crm_fields_json, 'Country')) {
				address = address + crm_fields_json['Country'] + ', ';
			}
			address = address.trim();
			address = (address.endsWith(',') ? address.substring(0, address.length-1) : address);
			if (_.has(crm_fields_json, 'Zip Code')) {
				address = address + ' - ' + crm_fields_json['Zip Code'];
			}

			var other_fields = [];
			var other_crm_fields = _.omit(crm_fields_json, 'Last Name', 'First Name', 'Company', 'Lead Owner', 'Email', 'Mobile', 'Lead Status', 'Street', 'City', 'State', 'Country', 'Zip Code', 'MODIFIEDBY');
			_.each(other_crm_fields, function(field_value, field_name) {
				if (!field_name.endsWith('ID')) {
					other_fields.push({'key': field_name, 'val': field_value});
				}
			});
			if (address !== '') {
				other_fields.unshift({'key': 'Address', 'val': address});
			}
			if (lead_status !== '') {
				other_fields.unshift({'key': 'Lead Status', 'val': lead_status});
			}
			if (lead_owner !== '') {
				other_fields.unshift({'key': 'Lead Owner', 'val': lead_owner});
			}

			var lead_info = {};
			lead_info.lead_name = lead_name;
			lead_info.company = company;
			lead_info.lead_owner = lead_owner;
			lead_info.email = lead_email;
			lead_info.has_phone = (phone !== "");
			lead_info.phone = phone;
			lead_info.has_mobile = (mobile !== "");
			lead_info.mobile = mobile;
			lead_info.lead_status = lead_status;
			lead_info.has_address = (address === '' ? false : true);
			lead_info.address = address;
			lead_info.other_fields = other_fields;

			this.crm_data = lead_info;
			this.crm_data.module = 'Leads';
			this.crm_data.rec_id = crm_fields_json['LEADID'];

			this.switchTo('lead_info', {'lead': lead_info});

			// by default showing crm fields
			this.switchSubTab('crm_fields', '');
		}
	},

	showAccountInfo: function(data) {
		if (typeof(data.response.nodata) != 'undefined') {
			this.switchTo('nodata_screen');
		}
		else if (typeof(data.response.error) != 'undefined') {
			this.switchTo('error_screen');
		}
		else {
			var crm_fields = [];
			if (typeof(data.response.result.Accounts.row.length) != 'undefined' && data.response.result.Accounts.row.length > 1) {
				crm_fields = data.response.result.Accounts.row[0].FL;
			}
			else {
				crm_fields = data.response.result.Accounts.row.FL;
			}

			var crm_fields_json = {};
			_.each(crm_fields, function(crm_field) {
				crm_fields_json[crm_field.val] = crm_field.content;
			});

			var account_name = {};
			account_name.name = _.result(crm_fields_json, 'Account Name', '');
			account_name.link = helpers.fmt('%@/crm/EntityInfo.do?module=Accounts&id=%@', this.resources.ZOHOCRM_URL, crm_fields_json['ACCOUNTID']);
			
			var industry = _.result(crm_fields_json, 'Industry', '');
			var website = _.result(crm_fields_json, 'Website', '');
			var account_owner = crm_fields_json['Account Owner'];
			var phone = _.result(crm_fields_json, 'Phone', '');

			var billing_address = '';
			if (_.has(crm_fields_json, 'Billing Street')) {
				billing_address = billing_address + crm_fields_json['Billing Street'] + ', ';
			}
			if (_.has(crm_fields_json, 'Billing City')) {
				billing_address = billing_address + crm_fields_json['Billing City'] + ', ';
			}
			if (_.has(crm_fields_json, 'Billing State')) {
				billing_address = billing_address + crm_fields_json['Billing State'] + ', ';
			}
			if (_.has(crm_fields_json, 'Billing Country')) {
				billing_address = billing_address + crm_fields_json['Billing Country'] + ', ';
			}
			billing_address = billing_address.trim();
			billing_address = (billing_address.endsWith(',') ? billing_address.substring(0, billing_address.length-1) : billing_address);
			if (_.has(crm_fields_json, 'Billing Code')) {
				billing_address = billing_address + ' - ' + crm_fields_json['Billing Code'];
			}

			var shipping_address = '';
			if (_.has(crm_fields_json, 'Shipping Street')) {
				shipping_address = shipping_address + crm_fields_json['Shipping Street'] + ', ';
			}
			if (_.has(crm_fields_json, 'Shipping City')) {
				shipping_address = shipping_address + crm_fields_json['Shipping City'] + ', ';
			}
			if (_.has(crm_fields_json, 'Shipping State')) {
				shipping_address = shipping_address + crm_fields_json['Shipping State'] + ', ';
			}
			if (_.has(crm_fields_json, 'Shipping Country')) {
				shipping_address = shipping_address + crm_fields_json['Shipping Country'] + ', ';
			}
			shipping_address = shipping_address.trim();
			shipping_address = (shipping_address.endsWith(',') ? shipping_address.substring(0, shipping_address.length-1) : shipping_address);
			if (_.has(crm_fields_json, 'Shipping Code')) {
				shipping_address = shipping_address + ' - ' + crm_fields_json['Shipping Code'];
			}

			var other_fields = [];
			var other_crm_fields = _.omit(crm_fields_json, 'Account Name', 'Industry', 'Account Owner', 'Website', 'Phone', 'Billing Street', 'Billing City', 'Billing State', 'Billing Country', 'Billing Code', 'Shipping Street', 'Shipping City', 'Shipping State', 'Shipping Country', 'Shipping Code', 'MODIFIEDBY');
			_.each(other_crm_fields, function(field_value, field_name) {
				if (!field_name.endsWith('ID')) {
					other_fields.push({'key': field_name, 'val': field_value});
				}
			});
			if (shipping_address !== '') {
				other_fields.unshift({'key': 'Shipping Address', 'val': shipping_address});
			}
			if (billing_address !== '') {
				other_fields.unshift({'key': 'Billing Address', 'val': billing_address});
			}
			if (account_owner !== '') {
				other_fields.unshift({'key': 'Account Owner', 'val': account_owner});
			}

			var account_info = {};
			account_info.rec_id = crm_fields_json['ACCOUNTID'];
			account_info.account_name = account_name;
			account_info.has_website = (website !== "");
			account_info.website = website;
			account_info.has_industry = (industry !== "");
			account_info.industry = industry;
			account_info.account_owner = account_owner;
			account_info.has_phone = (phone !== "");
			account_info.phone = phone;
			account_info.other_fields = other_fields;

			this.crm_data = account_info;
			this.crm_data.module = 'Accounts';
			this.crm_data.rec_id = crm_fields_json['ACCOUNTID'];

			this.switchTo('account_info', {'account': account_info});

			// by default showing crm fields
			this.switchSubTab('crm_fields', '');
		}
	},

	showRelatedRecords: function(data) {
		this.showSpinner(false);

		var finalData = {};

		if (typeof(data.response.nodata) != 'undefined') {
			finalData.nodata = true;
			finalData.template_name = 'subtab-nodata';
		}
		else if (typeof(data.response.error) != 'undefined') {
			finalData.error = true;
			finalData.template_name = 'subtab-error';
		}
		else {

			var ZOHOCRM_URL = this.resources.ZOHOCRM_URL;

			var relatedModule = _.keys(data.response.result)[0];

			var records_array = [];
			if (typeof(data.response.result[relatedModule].row.length) != 'undefined' && data.response.result[relatedModule].row.length > 1) {
				records_array = data.response.result[relatedModule].row;
			}
			else {
				records_array.push(data.response.result[relatedModule].row);
			}

			var new_records_array = [];
			_.each(records_array, function(record) {
				var crm_fields_json = {};
				_.each(record.FL, function(field) {
					crm_fields_json[field.val] = field.content;
				});

				new_records_array.push(crm_fields_json);
			});

			if (relatedModule == 'Notes') {

				var notesJson = [];
				_.each(new_records_array, function(record) {
					var noteInfo = {};
					noteInfo['added_by'] = record['Owner Name'];
					noteInfo['added_on'] = record['Created Time'];
					noteInfo['title'] = (_.has(record, 'Title') ? record['Title'] : false);
					noteInfo['comment'] = record['Note Content'];
					notesJson.push(noteInfo);
				});

				finalData.template_name = 'notes';
				finalData.notes = notesJson;
			}
			else if (relatedModule == 'Potentials') {

				var potentialsJson = [];
				_.each(new_records_array, function(record) {
					var potentialInfo = {};

					potentialInfo['name'] = record['Potential Name'];
					potentialInfo.link = helpers.fmt('%@/crm/EntityInfo.do?module=Potentials&id=%@', ZOHOCRM_URL, record['POTENTIALID']);
					potentialInfo['owner'] = record['Potential Owner'];
					potentialInfo['amount'] = (_.has(record, 'Amount') ? record['Amount'] : "-");
					potentialInfo['stage'] = record['Stage'];
					potentialInfo['probability'] = record['Probability'];
					potentialsJson.push(potentialInfo);
				});

				finalData.template_name = 'potentials';
				finalData.potentials = potentialsJson;
			}
			else if (relatedModule == 'Products') {
				var productsJson = [];
				_.each(new_records_array, function(record) {
					var productInfo = {};

					var status = (_.has(record, 'Product Active') ? record['Product Active'] : "true");
					status = (status == "true") ? "Active" : "Inactive";

					productInfo['name'] = record['Product Name'];
					productInfo.link = helpers.fmt('%@/crm/EntityInfo.do?module=Products&id=%@', ZOHOCRM_URL, record['PRODUCTID']);
					productInfo['product_code'] = (_.has(record, 'Product Code') ? record['Product Code'] : "--");
					productInfo['category'] = (_.has(record, 'Product Category') ? record['Product Category'] : "--");
					productInfo['status'] = status;

					productsJson.push(productInfo);
				});

				finalData.template_name = 'products';
				finalData.products = productsJson;
			}
			else if (relatedModule == 'Events') {
				var eventsJson = [];
				_.each(new_records_array, function(record) {
					var eventInfo = {};

					eventInfo['subject'] = record['Subject'];
					eventInfo.link = helpers.fmt('%@/crm/EntityInfo.do?module=Events&id=%@', ZOHOCRM_URL, record['ACTIVITYID']);
					eventInfo['owner'] = record['Event Owner'];
					eventInfo['start_time'] = record['Start DateTime'];
					eventInfo['end_time'] = record['End DateTime'];
					eventInfo['venue'] = (_.has(record, 'Venue') ? record['Venue'] : "--");

					eventsJson.push(eventInfo);
				});

				finalData.template_name = 'events_activity';
				finalData.events = eventsJson;
			}
		}

		if (typeof(finalData.template_name) == "undefined") {
			finalData.template_name = 'subtab-nodata';
		}
		var html = this.renderTemplate(finalData.template_name, {'data': finalData});
		this.$('.data_div').html(html);
	},

	handleSubTabFailure: function() {
		this.showSpinner(false);
	},

	switchSubTab: function(tab_name, module_name) {
		this.switchNavTo(tab_name);
		this.$('.data_div').html('');
		this.showSpinner(true);

		if (tab_name == 'crm_fields') {
			var html = this.renderTemplate(tab_name, {'crm_fields': this.crm_data.other_fields});
			this.$('.data_div').html(html);

			this.showSpinner(false);
		}
		else {			
      		this.fetchZCRMRelatedRecords(this.crm_data.module, this.crm_data.rec_id, module_name);
		}
	},

    fetchZCRMContactInfo: function(email_id) {
    	this.ajax('get_zcrm_contact_info', email_id);
    },

    fetchZCRMLeadInfo: function(email_id) {
    	this.ajax('get_zcrm_lead_info', email_id);
    },

    fetchZCRMAccountInfo: function(accountname) {
        this.ajax('get_zcrm_account_info', accountname);
    },

    fetchZCRMRelatedRecords: function(module, recId, relatedModule) {
    	this.ajax('get_related_records', module, recId, relatedModule);
    },

    requests: {
		get_zcrm_contact_info: function(email_id) {
			return {
				url: helpers.fmt('%@/crm/private/json/Contacts/getSearchRecordsByPDC?authtoken={{setting.authtoken}}&scope=crmapi&selectColumns=All&searchColumn=email&searchValue=%@', this.resources.ZOHOCRM_URL, email_id),
				type: 'GET',
				dataType: 'json',
				secure: true
			};
		},
		get_zcrm_lead_info: function(email_id) {
			return {
				url: helpers.fmt('%@/crm/private/json/Leads/getSearchRecordsByPDC?authtoken={{setting.authtoken}}&scope=crmapi&selectColumns=All&searchColumn=email&searchValue=%@', this.resources.ZOHOCRM_URL, email_id),
				type: 'GET',
				dataType: 'json',
				secure: true
			};
		},
		get_zcrm_account_info: function(accountname) {
			return {
				url: helpers.fmt('%@/crm/private/json/Accounts/getSearchRecordsByPDC?authtoken={{setting.authtoken}}&scope=crmapi&selectColumns=All&searchColumn=accountname&searchValue=%@', this.resources.ZOHOCRM_URL, accountname),
				type: 'GET',
				dataType: 'json',
				secure: true
			};
		},
		get_related_records: function(module, recId, relatedModule) {
			return {
				url: helpers.fmt('%@/crm/private/json/%@/getRelatedRecords?authtoken={{setting.authtoken}}&scope=crmapi&id=%@&parentModule=%@', this.resources.ZOHOCRM_URL, relatedModule, recId, module),
				type: 'GET',
				dataType: 'json',
				secure: true
			};
		}
    },

	showSpinner: function(show) {
      if (show) {
        this.$('.loading_spinner').css('display', 'block');
      } else {
        this.$('.loading_spinner').css('display', 'none');
      }
    },

    switchNavTo: function(itemClass) {
      itemClass = '.' + itemClass;

      this.$('.tabs-menu li').removeClass('current');
      this.$('.tabs-menu li' + itemClass).addClass('current');
    }
  };

}());