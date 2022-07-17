define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var app = {
		name: 'recordings',

		css: [ 'app' ],

		i18n: {
			'de-DE': { customCss: false },
			'en-US': { customCss: false }
		},

		appFlags: {
			recordings: {
				maxRange: 31,
				defaultRange: 1,
				minPhoneNumberLength: 7
			}
		},

		requests: {
			'recordings.get': {
				'verb': 'GET',
				'url': 'accounts/{accountId}/recordings?{filters}'
			},
			'recordings.user.get': {
				'verb': 'GET',
				'url': 'accounts/{accountId}/users/{userId}/recordings?{filters}'
			},
			'recordings.delete': {
				'verb': 'DELETE',
				'url': 'accounts/{accountId}/recordings/{recordingId}'
			}
		},
		subscribe: {},

		load: function(callback) {
			var self = this;

			self.initApp(function() {
				callback && callback(self);
			});
		},

		initApp: function(callback) {
			var self = this;

			monster.pub('auth.initApp', {
				app: self,
				callback: callback
			});
		},

		render: function(container) {
			var self = this;

			var menus = [
				{
					tabs: [
						{
							text: self.i18n.active().recordings.menuTitles.receivedRECs,
							callback: self.renderReceivedRECs
						}
					]
				}
			];

			monster.ui.generateAppLayout(self, {
				menus: menus
			});
		},

		renderReceivedRECs: function(pArgs) {
			var self = this,
				args = pArgs || {},
				parent = args.container || $('#recordings_app_container .app-content-wrapper');

			self.listRECBoxes(function(recboxes) {
				var dataTemplate = {
						recboxes: recboxes,
						count: recboxes.length
					},
					template = $(self.getTemplate({
						name: 'received-recordings',
						data: dataTemplate
					}));

				self.recordingsInitDatePicker(parent, template);

				self.bindReceivedRECs(template);

				parent
					.fadeOut(function() {
						$(this)
							.empty()
							.append(template)
							.fadeIn();
					});
			});
		},

		recordingsInitDatePicker: function(parent, template) {
			var self = this,
				dates = monster.util.getDefaultRangeDates(self.appFlags.recordings.defaultRange),
				fromDate = dates.from,
				toDate = dates.to;

			var optionsDatePicker = {
				container: template,
				range: self.appFlags.recordings.maxRange
			};

			monster.ui.initRangeDatepicker(optionsDatePicker);

			template.find('#startDate').datepicker('setDate', fromDate);
			template.find('#endDate').datepicker('setDate', toDate);

			template.find('.apply-filter').on('click', function(e) {
				var recboxId = template.find('#select_recbox').val();

				self.displayRECList(parent, recboxId);
			});

			template.find('.toggle-filter').on('click', function() {
				template.find('.filter-by-date').toggleClass('active');
			});
		},

		bindReceivedRECs: function(template) {
			var self = this,
				$selectRECBox = template.find('.select-recbox');

			monster.ui.tooltips(template);
			monster.ui.footable(template.find('.footable'));

			monster.ui.chosen($selectRECBox, {
				placeholder_text_single: self.i18n.active().recordings.receivedRECs.actionBar.selectREC.none
			});

			// Default selection when page is loaded
			self.displayRECList(template, "all");

			$selectRECBox.on('change', function() {
				var recboxId = $(this).val();

				self.displayRECList(template, recboxId);
			});

			template.find('#refresh_recordings').on('click', function() {
				var recboxId = $selectRECBox.val();

				if (recboxId !== 'none') {
					self.displayRECList(template, recboxId);
				}
			});

			template.find('.mark-as-link').on('click', function() {
				var folder = $(this).data('type'),
					recboxId = $selectRECBox.val(),
					$recordings = template.find('.select-recording:checked'),
					recordings = [];

				$recordings.each(function() {
					recordings.push($(this).data('media-id'));
				});

				template.find('.data-state')
						.hide();

				template.find('.loading-state')
						.show();
			});

			template.find('.delete-recordings').on('click', function() {
				var recboxId = $selectRECBox.val(),
					$recordings = template.find('.select-recording:checked'),
					recordings = [];

				$recordings.each(function() {
					recordings.push($(this).data('media-id'));
				});

				template.find('.data-state')
						.hide();

				template.find('.loading-state')
						.show();

				self.bulkRemoveRecordings(recboxId, recordings, function() {
					self.displayRECList(template, recboxId);
				});
			});

			template.on('click', '.play-rec', function(e) {
				var $row = $(this).parents('.recording-row'),
					$activeRows = template.find('.recording-row.active');

				if (!$row.hasClass('active') && $activeRows.length !== 0) {
					return;
				}

				e.stopPropagation();

				var recboxId = template.find('#select_recbox').val(),
					mediaId = $row.data('media-id');

				template.find('table').addClass('highlighted');
				$row.addClass('active');

				self.playRecording(template, recboxId, mediaId);
			});

			template.on('click', '.details-rec', function() {
				var $row = $(this).parents('.recording-row'),
					callId = $row.data('call-id');

				self.getCDR(callId, function(cdr) {
					var template = $(self.getTemplate({
						name: 'recordings-CDRDialog'
					}));

					monster.ui.renderJSON(cdr, template.find('#jsoneditor'));

					monster.ui.dialog(template, { title: self.i18n.active().recordings.receivedRECs.CDRPopup.title });
				}, function() {
					monster.ui.alert(self.i18n.active().recordings.receivedRECs.noCDR);
				});
			});

			var afterSelect = function() {
				if (template.find('.select-recording:checked').length) {
					template.find('.hidable').removeClass('hidden');
					template.find('.main-select-recording').prop('checked', true);
				} else {
					template.find('.hidable').addClass('hidden');
					template.find('.main-select-recording').prop('checked', false);
				}
			};

			template.on('change', '.select-recording', function() {
				afterSelect();
			});

			template.find('.main-select-recording').on('click', function() {
				var $this = $(this),
					isChecked = $this.prop('checked');

				template.find('.select-recording').prop('checked', isChecked);

				afterSelect();
			});

			template.find('.select-some-recordings').on('click', function() {
				var $this = $(this),
					type = $this.data('type');

				template.find('.select-recording').prop('checked', false);

				if (type !== 'none') {
					if (type === 'all') {
						template.find('.select-recording').prop('checked', true);
					} else if (['new', 'saved', 'deleted'].indexOf(type) >= 0) {
						template.find('.recording-row[data-folder="' + type + '"] .select-recording').prop('checked', true);
					}
				}

				afterSelect();
			});

			template.on('click', '.select-line', function() {
				if (template.find('table').hasClass('highlighted')) {
					return;
				}

				var cb = $(this).parents('.recording-row').find('.select-recording');

				cb.prop('checked', !cb.prop('checked'));
				afterSelect();
			});
		},

		removeOpacityLayer: function(template, $activeRows) {
			$activeRows.find('.recording-player').remove();
			$activeRows.find('.duration, .actions').show();
			$activeRows.removeClass('active');
			template.find('table').removeClass('highlighted');
		},

		formatRECURI: function(recboxId, mediaId) {
			var self = this;

			return self.apiUrl + 'accounts/' + self.accountId + '/recordings/' + mediaId + '?accept=audio/mpeg&auth_token=' + self.getAuthToken();
		},

		playRecording: function(template, recboxId, mediaId) {
			var self = this,
				$row = template.find('.recording-row[data-media-id="' + mediaId + '"]');

			template.find('table').addClass('highlighted');
			$row.addClass('active');

			$row.find('.duration, .actions').hide();

			var uri = self.formatRECURI(recboxId, mediaId),
				dataTemplate = {
					uri: uri
				},
				templateCell = $(self.getTemplate({
					name: 'cell-recording-player',
					data: dataTemplate
				}));

			$row.append(templateCell);

			var closePlayerOnClickOutside = function(e) {
					if ($(e.target).closest('.recording-player').length) {
						return;
					}
					e.stopPropagation();
					closePlayer();
				},
				closePlayer = function() {
					$(document).off('click', closePlayerOnClickOutside);
					self.removeOpacityLayer(template, $row);
				};

			$(document).on('click', closePlayerOnClickOutside);

			templateCell.find('.close-player').on('click', closePlayer);

			// Autoplay in JS. For some reason in HTML, we can't pause the stream properly for the first play.
			templateCell.find('audio').get(0).play();
		},

		recordingsGetRows: function(filters, recboxId, callback) {
			var self = this;

			self.newGetRECBoxMessages(filters, recboxId, function(data) {
				var formattedData = self.formatRecordingsData(data.data, recboxId),
					dataTemplate = {
						recordings: formattedData.recordings
					},
					$rows = $(self.getTemplate({
						name: 'recordings-rows',
						data: dataTemplate
					}));

				callback && callback($rows, data, formattedData);
			});
		},

		displayRECList: function(container, recboxId) {
			var self = this,
				fromDate = container.find('input.filter-from').datepicker('getDate'),
				toDate = container.find('input.filter-to').datepicker('getDate'),
				filterByDate = container.find('.filter-by-date').hasClass('active');

			container.removeClass('empty');
			//container.find('.counts-wrapper').hide();
			container.find('.count-wrapper[data-type="new"] .count-text').html('?');
			container.find('.count-wrapper[data-type="total"] .count-text').html('?');

			// Gives a better feedback to the user if we empty it as we click... showing the user something is happening.
			container.find('.data-state')
						.hide();

			container.find('.loading-state')
						.show();

			container.find('.hidable').addClass('hidden');
			container.find('.main-select-recording').prop('checked', false);

			monster.ui.footable(container.find('.recordings-table .footable'), {
				getData: function(filters, callback) {
					if (filterByDate) {
						filters = $.extend(true, filters, {
							created_from: monster.util.dateToBeginningOfGregorianDay(fromDate),
							created_to: monster.util.dateToEndOfGregorianDay(toDate)
						});
					}
					// we do this to keep context
					self.recordingsGetRows(filters, recboxId, function($rows, data, formattedData) {
						container.find('.count-wrapper[data-type="new"] .count-text').html(formattedData.counts.newRecordings);
						container.find('.count-wrapper[data-type="total"] .count-text').html(formattedData.counts.totalRecordings);

						callback && callback($rows, data);
					});
				},
				afterInitialized: function() {
					container.find('.data-state')
								.show();

					container.find('.loading-state')
								.hide();
				},
				backendPagination: {
					enabled: false
				}
			});
		},

		formatRecordingsData: function(recordings, recboxId) {
			var self = this,
				tryFormatPhoneNumber = function(value) {
					var minPhoneNumberLength = self.appFlags.recordings.minPhoneNumberLength,
						prefixedPhoneNumber,
						formattedPhoneNumber;

					if (_.size(value) < minPhoneNumberLength) {
						return {
							isPhoneNumber: false,
							value: value,
							userFormat: value
						};
					}

					prefixedPhoneNumber = _.head(value) === '+'
						? value
						: /^\d+$/.test(value)	// Prepend '+' if there are only numbers
							? '+' + value
							: value;
					formattedPhoneNumber = monster.util.getFormatPhoneNumber(prefixedPhoneNumber);

					return {
						isPhoneNumber: formattedPhoneNumber.isValid,
						value: formattedPhoneNumber.isValid
							? formattedPhoneNumber.e164Number
							: value,
						userFormat: formattedPhoneNumber.isValid
							? formattedPhoneNumber.userFormat
							: value
					};
				},
				formattedRecordings = _.map(recordings, function(rec) {
					var to = rec.to.substr(0, rec.to.indexOf('@')),
						from = rec.from.substr(0, rec.from.indexOf('@')),
						callerIDName = _.get(rec, 'caller_id_name', ''),
						formattedTo = tryFormatPhoneNumber(to),
						formattedFrom = tryFormatPhoneNumber(from),
						formattedCallerIDName = tryFormatPhoneNumber(callerIDName);

					return _.merge({
						formatted: {
							to: formattedTo,
							from: formattedFrom,
							callerIDName: formattedCallerIDName,
							duration: monster.util.friendlyTimer(rec.duration_ms / 1000),
							uri: self.formatRECURI(recboxId, rec.id),
							callId: monster.util.getModbID(rec.call_id, rec.start),
							mediaId: rec.id,
							showCallerIDName: formattedCallerIDName.value !== formattedFrom.value
						},
						direction: rec.direction,
						timestamp: rec.start
					}, rec);
				}),
				formattedData = {
					recordings: formattedRecordings,
					counts: {
						newRecordings: _.sumBy(recordings, function(rec) {
							return _
								.chain(rec)
								.get('folder')
								.isEqual('new')
								.toInteger()
								.value();
						}),
						totalRecordings: recordings.length
					}
				};
			return formattedData;
		},

		getCDR: function(callId, callback, error) {
			var self = this;

			self.callApi({
				resource: 'cdrs.get',
				data: {
					accountId: self.accountId,
					cdrId: callId,
					generateError: false
				},
				success: function(data) {
					callback && callback(data.data);
				},
				error: function(data, status, globalHandler) {
					if (data && data.error === '404') {
						error && error({});
					} else {
						globalHandler(data, { generateError: true });
					}
				}
			});
		},

		newGetRECBoxMessages: function(filters, recboxId, callback) {
			var self = this;

			if (recboxId === 'all') {
				monster.request({
					resource: 'recordings.get',
					data: {
						accountId: self.accountId,
						filters: filters
					},
					success: function(data) {
						callback && callback(data);
					}
				});
			} else {
				monster.request({
					resource: 'recordings.user.get',
					data: {
						accountId: self.accountId,
						userId: recboxId,
						filters: filters
					},
					success: function(data) {
						callback && callback(data);
					}
				});
			}
		},

		bulkRemoveRecordings: function(recboxId, recordings, callback) {
			var self = this;

			$.each(recordings, function(i, recordingId){
				monster.request({
					resource: 'recordings.delete',
					data: {
						accountId: self.accountId,
						recordingId: recordingId
					},
					success: function(data) {
						callback && callback(data.data);
					}
				});
			})
		},

		listRECBoxes: function(callback) {
			var self = this;

			self.callApi({
				resource: 'user.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false
					}
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		}
	};

	return app;
});
