// ==UserScript==
// @name         Meiro Improvements
// @version      1.1.1
// @description  Meiro Better Workflow - fixed sort button functionality
// @author       Vojta Florian
// @match        *.meiro.io/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=meiro.io
// @downloadURL  https://raw.githubusercontent.com/vojtaflorian/Meiro-Improvements/refs/heads/main/meiro-improvements.user.js?v=@version
// @updateURL    https://raw.githubusercontent.com/vojtaflorian/Meiro-Improvements/refs/heads/main/meiro-improvements.user.js?v=@version
// @grant        none
// ==/UserScript==


(function() {
    'use strict';

    //===================================================================================
    // CONFIGURATION
    //===================================================================================
    
    /**
     * Central configuration object containing all script settings and constants
     */
    const CONFIG = {
        // Logging configuration
        logging: {
            enabled: true,
            level: 'INFO', // DEBUG, INFO, WARN, ERROR
            prefix: '🔧 Meiro Better WF',
            includeTimestamp: true,
            includeStackTrace: true
        },
        
        // Sort functionality configuration
        sort: {
            maxAttempts: 20,
            retryInterval: 500, // milliseconds
            initialDelay: 1000,
            clickDelay: 300,
            searchTerms: ['modified', 'upraveno', 'změněno', 'modified at']
        },
        
        // Form filling configuration
        form: {
            campaignUrlPattern: 'meiro.io/channels/emails/campaigns',
            profileId: '00059461-1b48-f552-3d8c-9f0422f5aef8',
            maxFillAttempts: 30,
            fillInterval: 1000,
            menuOpenDelay: 500,
            selectDelay: 500,
            selectors: {
                userMenu: "[data-testid='user-menu']",
                email: ".clYaW",
                emailSelect: "[data-testid='send-test-emails-select']",
                emailInput: ".react-select-redux-field__input input",
                dropdownMenu: ".react-select-redux-field__menu",
                selectOption: "[data-testid='select-field-option']",
                profileInput: "input[data-testid='send-test-emails-profile-id']",
                multiValue: ".react-select-redux-field__multi-value"
            }
        },
        
        // Size monitor configuration
        sizeMonitor: {
            urlPattern: 'meiro.io/channels/emails/campaigns',
            monitorInterval: 3000,
            selector: 'textarea.ace_text-input',
            displayId: 'size-display',
            position: {
                bottom: '10px',
                right: '10px'
            }
        },
        
        // Delete button focus configuration
        deleteButton: {
            selector: '[data-testid="confirm-modal-delete-button"]',
            focusInterval: 50,
            timeout: 2000
        },
        
        // Resource management
        resources: {
            cleanupOnUnload: true,
            maxIntervals: 50
        }
    };

    //===================================================================================
    // LOGGING SYSTEM
    //===================================================================================
    
    /**
     * Centralized logging manager with multiple log levels and formatting
     * Provides consistent logging interface across the entire application
     */
    class Logger {
        constructor(config) {
            this.config = config;
            this.levels = {
                DEBUG: 0,
                INFO: 1,
                WARN: 2,
                ERROR: 3
            };
            this.currentLevel = this.levels[config.level] || this.levels.INFO;
        }

        /**
         * Get formatted timestamp for log entries
         * @returns {string} Formatted timestamp
         */
        getTimestamp() {
            const now = new Date();
            return now.toISOString();
        }

        /**
         * Format log message with prefix, timestamp, and module information
         * @param {string} level - Log level
         * @param {string} module - Module name
         * @param {string} message - Log message
         * @returns {string} Formatted log message
         */
        formatMessage(level, module, message) {
            let formatted = `${this.config.prefix} [${level}]`;
            
            if (this.config.includeTimestamp) {
                formatted += ` [${this.getTimestamp()}]`;
            }
            
            formatted += ` [${module}]: ${message}`;
            return formatted;
        }

        /**
         * Check if message should be logged based on current log level
         * @param {string} level - Log level to check
         * @returns {boolean} True if message should be logged
         */
        shouldLog(level) {
            return this.config.enabled && this.levels[level] >= this.currentLevel;
        }

        /**
         * Log debug message
         * @param {string} module - Module name
         * @param {string} message - Log message
         * @param {*} data - Optional data to log
         */
        debug(module, message, data = null) {
            if (!this.shouldLog('DEBUG')) return;
            
            console.log(this.formatMessage('DEBUG', module, message));
            if (data) console.log(data);
        }

        /**
         * Log info message
         * @param {string} module - Module name
         * @param {string} message - Log message
         * @param {*} data - Optional data to log
         */
        info(module, message, data = null) {
            if (!this.shouldLog('INFO')) return;
            
            console.log(this.formatMessage('INFO', module, message));
            if (data) console.log(data);
        }

        /**
         * Log warning message
         * @param {string} module - Module name
         * @param {string} message - Log message
         * @param {*} data - Optional data to log
         */
        warn(module, message, data = null) {
            if (!this.shouldLog('WARN')) return;
            
            console.warn(this.formatMessage('WARN', module, message));
            if (data) console.warn(data);
        }

        /**
         * Log error message with optional stack trace
         * @param {string} module - Module name
         * @param {string} message - Error message
         * @param {Error} error - Error object
         */
        error(module, message, error = null) {
            if (!this.shouldLog('ERROR')) return;
            
            console.error(this.formatMessage('ERROR', module, message));
            
            if (error) {
                console.error('Error details:', error);
                if (this.config.includeStackTrace && error.stack) {
                    console.error('Stack trace:', error.stack);
                }
            }
        }

        /**
         * Log performance metrics
         * @param {string} module - Module name
         * @param {string} operation - Operation name
         * @param {number} duration - Duration in milliseconds
         */
        performance(module, operation, duration) {
            if (!this.shouldLog('INFO')) return;
            
            console.log(
                this.formatMessage('PERF', module, 
                    `Operation "${operation}" completed in ${duration}ms`)
            );
        }
    }

    //===================================================================================
    // RESOURCE MANAGER
    //===================================================================================
    
    /**
     * Centralized resource manager for intervals, timeouts, and observers
     * Ensures proper cleanup and prevents memory leaks
     */
    class ResourceManager {
        constructor(logger) {
            this.logger = logger;
            this.intervals = new Map();
            this.timeouts = new Map();
            this.observers = new Map();
            this.nextId = 0;
            
            this.logger.info('ResourceManager', 'Resource manager initialized');
            
            // Register cleanup on page unload
            if (CONFIG.resources.cleanupOnUnload) {
                window.addEventListener('beforeunload', () => this.cleanupAll());
            }
        }

        /**
         * Generate unique ID for resource tracking
         * @returns {string} Unique resource ID
         */
        generateId() {
            return `resource_${this.nextId++}`;
        }

        /**
         * Register and start an interval
         * @param {Function} callback - Callback function
         * @param {number} delay - Delay in milliseconds
         * @param {string} description - Description for logging
         * @returns {string} Resource ID
         */
        registerInterval(callback, delay, description = 'unnamed') {
            try {
                const id = this.generateId();
                const intervalId = setInterval(() => {
                    try {
                        callback();
                    } catch (error) {
                        this.logger.error('ResourceManager', 
                            `Error in interval callback: ${description}`, error);
                    }
                }, delay);
                
                this.intervals.set(id, {
                    intervalId,
                    description,
                    startTime: Date.now()
                });
                
                this.logger.debug('ResourceManager', 
                    `Registered interval: ${description} (ID: ${id})`);
                
                if (this.intervals.size > CONFIG.resources.maxIntervals) {
                    this.logger.warn('ResourceManager', 
                        `High number of active intervals: ${this.intervals.size}`);
                }
                
                return id;
            } catch (error) {
                this.logger.error('ResourceManager', 
                    'Failed to register interval', error);
                return null;
            }
        }

        /**
         * Register and start a timeout
         * @param {Function} callback - Callback function
         * @param {number} delay - Delay in milliseconds
         * @param {string} description - Description for logging
         * @returns {string} Resource ID
         */
        registerTimeout(callback, delay, description = 'unnamed') {
            try {
                const id = this.generateId();
                const timeoutId = setTimeout(() => {
                    try {
                        callback();
                        this.timeouts.delete(id); // Auto-cleanup after execution
                    } catch (error) {
                        this.logger.error('ResourceManager', 
                            `Error in timeout callback: ${description}`, error);
                    }
                }, delay);
                
                this.timeouts.set(id, {
                    timeoutId,
                    description,
                    startTime: Date.now()
                });
                
                this.logger.debug('ResourceManager', 
                    `Registered timeout: ${description} (ID: ${id})`);
                
                return id;
            } catch (error) {
                this.logger.error('ResourceManager', 
                    'Failed to register timeout', error);
                return null;
            }
        }

        /**
         * Register a MutationObserver
         * @param {MutationObserver} observer - Observer instance
         * @param {string} description - Description for logging
         * @returns {string} Resource ID
         */
        registerObserver(observer, description = 'unnamed') {
            try {
                const id = this.generateId();
                this.observers.set(id, {
                    observer,
                    description,
                    startTime: Date.now()
                });
                
                this.logger.debug('ResourceManager', 
                    `Registered observer: ${description} (ID: ${id})`);
                
                return id;
            } catch (error) {
                this.logger.error('ResourceManager', 
                    'Failed to register observer', error);
                return null;
            }
        }

        /**
         * Clear specific interval by ID
         * @param {string} id - Resource ID
         * @returns {boolean} Success status
         */
        clearInterval(id) {
            try {
                const resource = this.intervals.get(id);
                if (resource) {
                    clearInterval(resource.intervalId);
                    this.intervals.delete(id);
                    
                    const duration = Date.now() - resource.startTime;
                    this.logger.debug('ResourceManager', 
                        `Cleared interval: ${resource.description} (ran for ${duration}ms)`);
                    return true;
                }
                return false;
            } catch (error) {
                this.logger.error('ResourceManager', 
                    'Failed to clear interval', error);
                return false;
            }
        }

        /**
         * Clear specific timeout by ID
         * @param {string} id - Resource ID
         * @returns {boolean} Success status
         */
        clearTimeout(id) {
            try {
                const resource = this.timeouts.get(id);
                if (resource) {
                    clearTimeout(resource.timeoutId);
                    this.timeouts.delete(id);
                    
                    this.logger.debug('ResourceManager', 
                        `Cleared timeout: ${resource.description}`);
                    return true;
                }
                return false;
            } catch (error) {
                this.logger.error('ResourceManager', 
                    'Failed to clear timeout', error);
                return false;
            }
        }

        /**
         * Disconnect specific observer by ID
         * @param {string} id - Resource ID
         * @returns {boolean} Success status
         */
        disconnectObserver(id) {
            try {
                const resource = this.observers.get(id);
                if (resource) {
                    resource.observer.disconnect();
                    this.observers.delete(id);
                    
                    const duration = Date.now() - resource.startTime;
                    this.logger.debug('ResourceManager', 
                        `Disconnected observer: ${resource.description} (ran for ${duration}ms)`);
                    return true;
                }
                return false;
            } catch (error) {
                this.logger.error('ResourceManager', 
                    'Failed to disconnect observer', error);
                return false;
            }
        }

        /**
         * Clean up all registered resources
         */
        cleanupAll() {
            this.logger.info('ResourceManager', 
                'Starting cleanup of all resources');
            
            let cleanedCount = 0;
            
            try {
                // Clear all intervals
                for (const [id, resource] of this.intervals) {
                    clearInterval(resource.intervalId);
                    cleanedCount++;
                }
                this.intervals.clear();
                
                // Clear all timeouts
                for (const [id, resource] of this.timeouts) {
                    clearTimeout(resource.timeoutId);
                    cleanedCount++;
                }
                this.timeouts.clear();
                
                // Disconnect all observers
                for (const [id, resource] of this.observers) {
                    resource.observer.disconnect();
                    cleanedCount++;
                }
                this.observers.clear();
                
                this.logger.info('ResourceManager', 
                    `Cleanup completed. Cleaned ${cleanedCount} resources`);
            } catch (error) {
                this.logger.error('ResourceManager', 
                    'Error during cleanup', error);
            }
        }

        /**
         * Get current resource statistics
         * @returns {Object} Resource statistics
         */
        getStats() {
            return {
                intervals: this.intervals.size,
                timeouts: this.timeouts.size,
                observers: this.observers.size,
                total: this.intervals.size + this.timeouts.size + this.observers.size
            };
        }
    }

    //===================================================================================
    // SORT MANAGER
    //===================================================================================
    
    /**
     * Manages automatic sorting functionality on list pages
     * Searches for and clicks the "Modified" sort button to sort by newest first
     */
    class SortManager {
        constructor(logger, resourceManager) {
            this.logger = logger;
            this.resourceManager = resourceManager;
            this.config = CONFIG.sort;
            this.attempts = 0;
            this.intervalId = null;
            this.isRunning = false;
            
            this.logger.info('SortManager', 'Sort manager initialized');
        }

        /**
         * Find the sort button in the DOM
         * @returns {HTMLElement|null} Sort button element or null
         */
        findSortButton() {
            try {
                this.logger.debug('SortManager', 'Searching for sort button');
                
                const allButtons = document.querySelectorAll('button');
                
                if (!allButtons || allButtons.length === 0) {
                    this.logger.warn('SortManager', 'No buttons found on page');
                    return null;
                }
                
                this.logger.debug('SortManager', 
                    `Found ${allButtons.length} buttons, searching for sort button`);
                
                for (const button of allButtons) {
                    if (!button || !button.textContent) continue;
                    
                    const text = button.textContent.trim().toLowerCase();
                    
                    if (this.config.searchTerms.some(term => text.includes(term))) {
                        this.logger.info('SortManager', 
                            `Found sort button with text: "${button.textContent.trim()}"`);
                        return button;
                    }
                }
                
                this.logger.debug('SortManager', 
                    'Sort button not found in current DOM state');
                return null;
                
            } catch (error) {
                this.logger.error('SortManager', 
                    'Error while searching for sort button', error);
                return null;
            }
        }

        /**
         * Click the sort button twice to sort by newest first
         * @param {HTMLElement} button - Button element to click
         * @returns {Promise<boolean>} Success status
         */
        async clickSortButton(button) {
            try {
                if (!button) {
                    this.logger.warn('SortManager', 'Cannot click null button');
                    return false;
                }
                
                this.logger.info('SortManager', 'Executing sort button clicks');
                
                // First click to activate sort
                button.click();
                this.logger.debug('SortManager', 'First click executed');
                
                // Wait for UI to update
                await this.sleep(this.config.clickDelay);
                
                // Second click to reverse order (newest first)
                button.click();
                this.logger.debug('SortManager', 'Second click executed');
                
                this.logger.info('SortManager', 
                    'Sort button clicked successfully - sorting by newest');
                
                return true;
                
            } catch (error) {
                this.logger.error('SortManager', 
                    'Error while clicking sort button', error);
                return false;
            }
        }

        /**
         * Helper function for async sleep
         * @param {number} ms - Milliseconds to sleep
         * @returns {Promise}
         */
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * Search for sort button with retry logic
         */
        async searchForSortButton() {
            try {
                this.attempts++;
                this.logger.debug('SortManager', 
                    `Sort button search attempt ${this.attempts}/${this.config.maxAttempts}`);
                
                const button = this.findSortButton();
                
                if (button) {
                    const success = await this.clickSortButton(button);
                    
                    if (success) {
                        this.stopSearch();
                        this.logger.info('SortManager', 
                            'Sort functionality completed successfully');
                        return;
                    }
                }
                
                if (this.attempts >= this.config.maxAttempts) {
                    this.logger.warn('SortManager', 
                        `Maximum attempts (${this.config.maxAttempts}) reached, stopping search`);
                    this.stopSearch();
                }
                
            } catch (error) {
                this.logger.error('SortManager', 
                    'Error during sort button search', error);
            }
        }

        /**
         * Stop the search interval
         */
        stopSearch() {
            try {
                if (this.intervalId) {
                    this.resourceManager.clearInterval(this.intervalId);
                    this.intervalId = null;
                    this.isRunning = false;
                    this.logger.info('SortManager', 'Search stopped');
                }
            } catch (error) {
                this.logger.error('SortManager', 
                    'Error while stopping search', error);
            }
        }

        /**
         * Initialize and start the sort manager
         */
        initialize() {
            try {
                if (this.isRunning) {
                    this.logger.warn('SortManager', 
                        'Sort manager already running');
                    return;
                }
                
                this.logger.info('SortManager', 
                    'Starting sort manager initialization');
                
                this.isRunning = true;
                this.attempts = 0;
                
                // Start search after initial delay
                this.resourceManager.registerTimeout(
                    () => {
                        // First immediate attempt
                        this.searchForSortButton();
                        
                        // Then regular interval attempts
                        this.intervalId = this.resourceManager.registerInterval(
                            () => this.searchForSortButton(),
                            this.config.retryInterval,
                            'Sort button search'
                        );
                    },
                    this.config.initialDelay,
                    'Sort manager initial delay'
                );
                
            } catch (error) {
                this.logger.error('SortManager', 
                    'Error during initialization', error);
                this.isRunning = false;
            }
        }
    }

    //===================================================================================
    // FORM AUTO-FILLER
    //===================================================================================
    
    /**
     * Automatically fills "Send to" email and Profile ID fields in campaign forms
     * Retrieves user email from menu and pre-fills form fields
     */
    class FormAutoFiller {
        constructor(logger, resourceManager) {
            this.logger = logger;
            this.resourceManager = resourceManager;
            this.config = CONFIG.form;
            this.userEmail = null;
            this.fillAttempts = 0;
            this.fillIntervalId = null;
            this.isInitialized = false;
            
            this.logger.info('FormAutoFiller', 'Form auto-filler initialized');
        }

        /**
         * Check if current page is a campaign page
         * @returns {boolean} True if on campaign page
         */
        isCampaignPage() {
            const isCampaign = window.location.href.includes(
                this.config.campaignUrlPattern
            );
            
            this.logger.debug('FormAutoFiller', 
                `Campaign page check: ${isCampaign}`);
            
            return isCampaign;
        }

        /**
         * Safely query selector with error handling
         * @param {string} selector - CSS selector
         * @param {Element} parent - Parent element (optional)
         * @returns {Element|null} Found element or null
         */
        safeQuerySelector(selector, parent = document) {
            try {
                if (!selector) {
                    this.logger.warn('FormAutoFiller', 
                        'Empty selector provided');
                    return null;
                }
                
                return parent.querySelector(selector);
            } catch (error) {
                this.logger.error('FormAutoFiller', 
                    `Error querying selector: ${selector}`, error);
                return null;
            }
        }

        /**
         * Retrieve user email from user menu
         * @returns {Promise<string|null>} User email or null
         */
        async getUserEmail() {
            try {
                this.logger.info('FormAutoFiller', 
                    'Starting user email retrieval');
                
                const userMenu = this.safeQuerySelector(
                    this.config.selectors.userMenu
                );
                
                if (!userMenu) {
                    this.logger.warn('FormAutoFiller', 
                        'User menu not found');
                    return null;
                }
                
                this.logger.debug('FormAutoFiller', 
                    'User menu found, opening menu');
                
                userMenu.click();
                
                // Wait for menu to open
                await this.sleep(this.config.menuOpenDelay);
                
                const emailElement = this.safeQuerySelector(
                    this.config.selectors.email
                );
                
                if (!emailElement || !emailElement.textContent) {
                    this.logger.warn('FormAutoFiller', 
                        'Email element not found or empty');
                    return null;
                }
                
                const email = emailElement.textContent.trim();
                this.logger.info('FormAutoFiller', 
                    `User email retrieved: ${email}`);
                
                // Close menu by clicking outside or on menu again
                try {
                    userMenu.click();
                } catch (e) {
                    // Ignore errors when closing menu
                }
                
                return email;
                
            } catch (error) {
                this.logger.error('FormAutoFiller', 
                    'Error retrieving user email', error);
                return null;
            }
        }

        /**
         * Helper function for async sleep
         * @param {number} ms - Milliseconds to sleep
         * @returns {Promise}
         */
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * Simulate React input change event
         * Required for React-controlled components
         * @param {HTMLInputElement} input - Input element
         * @param {string} value - Value to set
         */
        simulateReactInput(input, value) {
            try {
                if (!input) {
                    this.logger.warn('FormAutoFiller', 
                        'Cannot simulate input on null element');
                    return;
                }
                
                this.logger.debug('FormAutoFiller', 
                    `Simulating React input with value: ${value}`);
                
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype, 
                    "value"
                ).set;
                
                nativeInputValueSetter.call(input, value);
                
                // Dispatch events in correct order for React
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
                
                this.logger.debug('FormAutoFiller', 
                    'React input simulation completed');
                
            } catch (error) {
                this.logger.error('FormAutoFiller', 
                    'Error simulating React input', error);
            }
        }

        /**
         * Fill email field in the form
         * @returns {Promise<boolean>} Success status
         */
        async fillEmailField() {
            try {
                if (!this.userEmail) {
                    this.logger.warn('FormAutoFiller', 
                        'Cannot fill email field - user email not available');
                    return false;
                }
                
                this.logger.info('FormAutoFiller', 
                    'Filling email field');
                
                const emailContainer = this.safeQuerySelector(
                    this.config.selectors.emailSelect
                );
                
                if (!emailContainer) {
                    this.logger.debug('FormAutoFiller', 
                        'Email container not found');
                    return false;
                }
                
                const emailInput = this.safeQuerySelector(
                    this.config.selectors.emailInput,
                    emailContainer
                );
                
                if (!emailInput) {
                    this.logger.debug('FormAutoFiller', 
                        'Email input not found');
                    return false;
                }
                
                // Check if already filled
                if (emailInput.value !== "") {
                    this.logger.info('FormAutoFiller', 
                        'Email field already filled');
                    return true;
                }
                
                // Focus and fill input
                emailInput.focus();
                this.simulateReactInput(emailInput, this.userEmail);
                
                // Wait for dropdown to appear
                await this.sleep(this.config.selectDelay);
                
                const dropdownMenu = this.safeQuerySelector(
                    this.config.selectors.dropdownMenu
                );
                
                if (!dropdownMenu) {
                    this.logger.warn('FormAutoFiller', 
                        'Dropdown menu did not appear');
                    return false;
                }
                
                const addEmailOption = this.safeQuerySelector(
                    this.config.selectors.selectOption,
                    dropdownMenu
                );
                
                if (!addEmailOption) {
                    this.logger.warn('FormAutoFiller', 
                        'Add email option not found in dropdown');
                    return false;
                }
                
                if (addEmailOption.textContent.includes(this.userEmail)) {
                    this.logger.info('FormAutoFiller', 
                        `Clicking on email option: ${this.userEmail}`);
                    addEmailOption.click();
                    return true;
                }
                
                return false;
                
            } catch (error) {
                this.logger.error('FormAutoFiller', 
                    'Error filling email field', error);
                return false;
            }
        }

        /**
         * Fill Profile ID field in the form
         * @returns {boolean} Success status
         */
        fillProfileIdField() {
            try {
                this.logger.info('FormAutoFiller', 
                    'Filling Profile ID field');
                
                const profileInput = this.safeQuerySelector(
                    this.config.selectors.profileInput
                );
                
                if (!profileInput) {
                    this.logger.debug('FormAutoFiller', 
                        'Profile ID input not found');
                    return false;
                }
                
                // Check if already filled correctly
                if (profileInput.value === this.config.profileId) {
                    this.logger.info('FormAutoFiller', 
                        'Profile ID already filled correctly');
                    return true;
                }
                
                this.simulateReactInput(profileInput, this.config.profileId);
                this.logger.info('FormAutoFiller', 
                    'Profile ID filled successfully');
                
                return true;
                
            } catch (error) {
                this.logger.error('FormAutoFiller', 
                    'Error filling Profile ID field', error);
                return false;
            }
        }

        /**
         * Check if form is completely filled
         * @returns {boolean} True if form is filled
         */
        isFormFilled() {
            try {
                const multiValue = this.safeQuerySelector(
                    this.config.selectors.multiValue
                );
                
                const profileInput = this.safeQuerySelector(
                    this.config.selectors.profileInput
                );
                
                const emailFilled = multiValue !== null;
                const profileFilled = profileInput && 
                    profileInput.value === this.config.profileId;
                
                return emailFilled && profileFilled;
                
            } catch (error) {
                this.logger.error('FormAutoFiller', 
                    'Error checking form fill status', error);
                return false;
            }
        }

        /**
         * Attempt to fill the form
         */
        async attemptFillForm() {
            try {
                this.fillAttempts++;
                
                this.logger.debug('FormAutoFiller', 
                    `Form fill attempt ${this.fillAttempts}/${this.config.maxFillAttempts}`);
                
                // Check if form is already filled
                if (this.isFormFilled()) {
                    this.logger.info('FormAutoFiller', 
                        'Form already filled, stopping fill attempts');
                    this.stopFilling();
                    return;
                }
                
                // Fill email field if user email is available
                if (this.userEmail) {
                    await this.fillEmailField();
                }
                
                // Fill Profile ID field
                this.fillProfileIdField();
                
                // Check if reached max attempts
                if (this.fillAttempts >= this.config.maxFillAttempts) {
                    this.logger.warn('FormAutoFiller', 
                        `Maximum fill attempts (${this.config.maxFillAttempts}) reached`);
                    this.stopFilling();
                }
                
            } catch (error) {
                this.logger.error('FormAutoFiller', 
                    'Error during form fill attempt', error);
            }
        }

        /**
         * Stop the fill interval
         */
        stopFilling() {
            try {
                if (this.fillIntervalId) {
                    this.resourceManager.clearInterval(this.fillIntervalId);
                    this.fillIntervalId = null;
                    this.logger.info('FormAutoFiller', 
                        'Form filling stopped');
                }
            } catch (error) {
                this.logger.error('FormAutoFiller', 
                    'Error stopping form filling', error);
            }
        }

        /**
         * Initialize form auto-filler
         */
        async initialize() {
            try {
                if (!this.isCampaignPage()) {
                    this.logger.info('FormAutoFiller', 
                        'Not on campaign page, skipping initialization');
                    return;
                }
                
                if (this.isInitialized) {
                    this.logger.warn('FormAutoFiller', 
                        'Form auto-filler already initialized');
                    return;
                }
                
                this.logger.info('FormAutoFiller', 
                    'Starting form auto-filler initialization');
                
                this.isInitialized = true;
                
                // Get user email first
                this.resourceManager.registerTimeout(
                    async () => {
                        this.userEmail = await this.getUserEmail();
                        
                        if (this.userEmail) {
                            this.logger.info('FormAutoFiller', 
                                'User email retrieved, starting form filling');
                        } else {
                            this.logger.warn('FormAutoFiller', 
                                'Failed to retrieve user email');
                        }
                        
                        // Start fill interval
                        this.fillIntervalId = this.resourceManager.registerInterval(
                            () => this.attemptFillForm(),
                            this.config.fillInterval,
                            'Form filling'
                        );
                    },
                    1000,
                    'Form auto-filler initial delay'
                );
                
            } catch (error) {
                this.logger.error('FormAutoFiller', 
                    'Error during initialization', error);
                this.isInitialized = false;
            }
        }
    }

    //===================================================================================
    // CONTENT SIZE MONITOR
    //===================================================================================
    
    /**
     * Monitors and displays the size of content in Ace Editor
     * Shows a floating display with content size in KB
     */
    class ContentSizeMonitor {
        constructor(logger, resourceManager) {
            this.logger = logger;
            this.resourceManager = resourceManager;
            this.config = CONFIG.sizeMonitor;
            this.displayElement = null;
            this.monitorIntervalId = null;
            this.isInitialized = false;
            
            this.logger.info('ContentSizeMonitor', 
                'Content size monitor initialized');
        }

        /**
         * Check if current page matches the monitor URL pattern
         * @returns {boolean} True if on target page
         */
        shouldMonitor() {
            const shouldMonitor = window.location.href.includes(
                this.config.urlPattern
            );
            
            this.logger.debug('ContentSizeMonitor', 
                `Monitor check: ${shouldMonitor}`);
            
            return shouldMonitor;
        }

        /**
         * Create or get the display element
         * @returns {HTMLElement} Display element
         */
        getOrCreateDisplayElement() {
            try {
                let element = document.getElementById(this.config.displayId);
                
                if (!element) {
                    this.logger.debug('ContentSizeMonitor', 
                        'Creating display element');
                    
                    element = document.createElement('div');
                    element.id = this.config.displayId;
                    element.style.position = 'fixed';
                    element.style.bottom = this.config.position.bottom;
                    element.style.right = this.config.position.right;
                    element.style.padding = '10px';
                    element.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                    element.style.color = 'white';
                    element.style.borderRadius = '5px';
                    element.style.fontSize = '14px';
                    element.style.zIndex = '10000';
                    element.style.display = 'none';
                    
                    document.body.appendChild(element);
                    
                    this.logger.info('ContentSizeMonitor', 
                        'Display element created');
                }
                
                return element;
                
            } catch (error) {
                this.logger.error('ContentSizeMonitor', 
                    'Error creating display element', error);
                return null;
            }
        }

        /**
         * Calculate content size in bytes using UTF-8 encoding
         * @param {string} content - Content to measure
         * @returns {number} Size in bytes
         */
        calculateContentSize(content) {
            try {
                if (!content || content.length === 0) {
                    return 0;
                }
                
                // Use TextEncoder for accurate UTF-8 byte count
                const encoder = new TextEncoder();
                const bytes = encoder.encode(content).length;
                
                this.logger.debug('ContentSizeMonitor', 
                    `Calculated content size: ${bytes} bytes`);
                
                return bytes;
                
            } catch (error) {
                this.logger.error('ContentSizeMonitor', 
                    'Error calculating content size', error);
                
                // Fallback to character count * 2 (UTF-8 approximation)
                return content.length * 2;
            }
        }

        /**
         * Get content from Ace Editor or textarea
         * @returns {string} Content text
         */
        getEditorContent() {
            try {
                const textarea = document.querySelector(this.config.selector);
                
                if (!textarea) {
                    this.logger.debug('ContentSizeMonitor', 
                        'Textarea not found');
                    return '';
                }
                
                // Try to get Ace Editor instance
                const aceEditor = textarea.closest('.ace_editor');
                
                if (aceEditor && window.ace) {
                    try {
                        const editor = window.ace.edit(aceEditor);
                        const content = editor.getValue();
                        
                        this.logger.debug('ContentSizeMonitor', 
                            'Content retrieved from Ace Editor');
                        
                        return content;
                    } catch (error) {
                        this.logger.warn('ContentSizeMonitor', 
                            'Failed to access Ace Editor, falling back to textarea', 
                            error);
                    }
                }
                
                // Fallback to textarea value
                this.logger.debug('ContentSizeMonitor', 
                    'Content retrieved from textarea');
                return textarea.value || '';
                
            } catch (error) {
                this.logger.error('ContentSizeMonitor', 
                    'Error getting editor content', error);
                return '';
            }
        }

        /**
         * Update the display with current content size
         */
        updateDisplay() {
            try {
                const content = this.getEditorContent();
                const sizeInBytes = this.calculateContentSize(content);
                const sizeInKB = (sizeInBytes / 1024).toFixed(2);
                
                const displayElement = this.getOrCreateDisplayElement();
                
                if (!displayElement) {
                    this.logger.warn('ContentSizeMonitor', 
                        'Display element not available');
                    return;
                }
                
                if (sizeInBytes > 0) {
                    displayElement.style.display = 'block';
                    displayElement.innerHTML = `Velikost obsahu: ${sizeInKB} KB`;
                    
                    this.logger.debug('ContentSizeMonitor', 
                        `Display updated: ${sizeInKB} KB`);
                } else {
                    displayElement.style.display = 'none';
                    
                    this.logger.debug('ContentSizeMonitor', 
                        'Content empty, hiding display');
                }
                
            } catch (error) {
                this.logger.error('ContentSizeMonitor', 
                    'Error updating display', error);
            }
        }

        /**
         * Initialize content size monitor
         */
        initialize() {
            try {
                if (!this.shouldMonitor()) {
                    this.logger.info('ContentSizeMonitor', 
                        'Not on target page, skipping initialization');
                    return;
                }
                
                if (this.isInitialized) {
                    this.logger.warn('ContentSizeMonitor', 
                        'Content size monitor already initialized');
                    return;
                }
                
                this.logger.info('ContentSizeMonitor', 
                    'Starting content size monitor');
                
                this.isInitialized = true;
                
                // Start monitoring interval
                this.monitorIntervalId = this.resourceManager.registerInterval(
                    () => this.updateDisplay(),
                    this.config.monitorInterval,
                    'Content size monitoring'
                );
                
                this.logger.info('ContentSizeMonitor', 
                    'Content size monitor started successfully');
                
            } catch (error) {
                this.logger.error('ContentSizeMonitor', 
                    'Error during initialization', error);
                this.isInitialized = false;
            }
        }

        /**
         * Stop monitoring
         */
        stop() {
            try {
                if (this.monitorIntervalId) {
                    this.resourceManager.clearInterval(this.monitorIntervalId);
                    this.monitorIntervalId = null;
                    this.isInitialized = false;
                    
                    // Hide display element
                    if (this.displayElement) {
                        this.displayElement.style.display = 'none';
                    }
                    
                    this.logger.info('ContentSizeMonitor', 
                        'Content size monitor stopped');
                }
            } catch (error) {
                this.logger.error('ContentSizeMonitor', 
                    'Error stopping monitor', error);
            }
        }
    }

    //===================================================================================
    // STYLE MANAGER
    //===================================================================================
    
    /**
     * Manages custom CSS styles and dynamic class application
     * Improves layout and responsiveness of Meiro interface
     */
    class StyleManager {
        constructor(logger, resourceManager) {
            this.logger = logger;
            this.resourceManager = resourceManager;
            this.styleElement = null;
            this.observerId = null;
            this.isInitialized = false;
            
            // Define class mappings for dynamic application
            this.classMap = {
                'content-wrap': ['width-fill-content'],
                'sm6GI': ['width-fill-content'],
                '_9rPmH': ['width-fill-content'],
                'ENn0I': ['width-fill-content'],
                '_748bX': ['width-fill-content'],
                'yHmIT': ['width-fill-content'],
                //,'box-border': ['width-auto']
            };
            
            this.logger.info('StyleManager', 'Style manager initialized');
        }

        /**
         * Add custom CSS styles to the page
         * @returns {boolean} Success status
         */
        addStyles() {
            try {
                this.logger.info('StyleManager', 'Adding custom styles');
                
                if (this.styleElement) {
                    this.logger.warn('StyleManager', 
                        'Styles already added, skipping');
                    return true;
                }
                
                this.styleElement = document.createElement('style');
                this.styleElement.type = 'text/css';
                this.styleElement.innerHTML = `
                    /* Responsive width adjustments */
                    @media (max-width: 1250px) {
                        .dyn_width_small div div section {
                            max-width: 90% !important;
                            width: 90% !important;
                        }
                    }

                    @media (min-width: 1320px) {
                        .dyn_width_large div div section {
                            min-width: 95% !important;
                        }
                    }

                    /* Width utilities */
                    .max-width-92 { 
                        min-width: 92% !important; 
                    }
                    
                    .max-width-89 { 
                        min-width: 89% !important; 
                    }

                    /* Flex utilities */
                    .flex-730 { 
                        flex: 0 0 730px; 
                    }
                    
                    .flex-500 { 
                        flex: 0 0 500px; 
                    }
                    
                    .flex-auto { 
                        flex: auto !important; 
                    }

                    /* Text input adjustments */
                    .TextInput_wrapper__6i7yo .TextInput_row__J20k3 .TextInput_warningWrapper__20GtL {
                        min-width: 450px !important;
                    }

                    /* Dynamic width classes */
                    .width-auto-content { 
                        width: -webkit-fill-available; 
                        max-width: -webkit-fill-available; 
                    }
                    
                    .width-fill-content { 
                        width: -webkit-fill-available !important; 
                        max-width: -webkit-fill-available !important; 
                        flex: auto !important;
                    }
                    
                    .width-auto { 
                        width: auto !important;
                    }

                    /* Email editor adjustments */
                    .EmailEditor_emailEditor__18vqj { 
                        width: auto !important; 
                    }

                    /* Wrapper adjustments */
                    .wrapper { 
                        max-width: 1600px !important; 
                    }

                    /* Files content height */
                    .files .scrollable.files-content {
                        max-height: 350px !important;
                    }
                    /* Journey blocks */
                   ._8MLCv {
                       white-space: normal !important;
                       overflow: visible !important;
                       text-overflow: unset !important;
                       word-wrap: break-word;
                       height: auto;
                       }
                `;
                
                document.head.appendChild(this.styleElement);
                
                this.logger.info('StyleManager', 
                    'Custom styles added successfully');
                
                return true;
                
            } catch (error) {
                this.logger.error('StyleManager', 
                    'Error adding styles', error);
                return false;
            }
        }

        /**
         * Apply classes to matching elements
         * @returns {number} Number of elements updated
         */
        applyClasses() {
            try {
                let elementsUpdated = 0;
                
                this.logger.debug('StyleManager', 
                    'Applying dynamic classes to elements');
                
                for (const [targetClass, newClasses] of Object.entries(this.classMap)) {
                    try {
                        const selector = `.${targetClass}`;
                        const elements = document.querySelectorAll(selector);
                        
                        if (elements.length === 0) {
                            continue;
                        }
                        
                        this.logger.debug('StyleManager', 
                            `Found ${elements.length} elements with class: ${targetClass}`);
                        
                        elements.forEach(element => {
                            if (!element) return;
                            
                            newClasses.forEach(newClass => {
                                if (!element.classList.contains(newClass)) {
                                    element.classList.add(newClass);
                                    elementsUpdated++;
                                }
                            });
                        });
                        
                    } catch (error) {
                        this.logger.error('StyleManager', 
                            `Error processing class: ${targetClass}`, error);
                    }
                }
                
                if (elementsUpdated > 0) {
                    this.logger.debug('StyleManager', 
                        `Applied classes to ${elementsUpdated} elements`);
                }
                
                return elementsUpdated;
                
            } catch (error) {
                this.logger.error('StyleManager', 
                    'Error applying classes', error);
                return 0;
            }
        }

        /**
         * Setup MutationObserver to watch for DOM changes
         */
        setupObserver() {
            try {
                this.logger.info('StyleManager', 
                    'Setting up DOM mutation observer');
                
                const observer = new MutationObserver((mutations) => {
                    try {
                        // Check if any relevant mutations occurred
                        const hasRelevantMutations = mutations.some(mutation => 
                            mutation.addedNodes.length > 0
                        );
                        
                        if (hasRelevantMutations) {
                            this.logger.debug('StyleManager', 
                                'DOM mutations detected, reapplying classes');
                            this.applyClasses();
                        }
                    } catch (error) {
                        this.logger.error('StyleManager', 
                            'Error in mutation observer callback', error);
                    }
                });
                
                observer.observe(document.body, { 
                    childList: true, 
                    subtree: true 
                });
                
                this.observerId = this.resourceManager.registerObserver(
                    observer,
                    'Style manager DOM observer'
                );
                
                this.logger.info('StyleManager', 
                    'DOM mutation observer set up successfully');
                
            } catch (error) {
                this.logger.error('StyleManager', 
                    'Error setting up observer', error);
            }
        }

        /**
         * Initialize style manager
         */
        initialize() {
            try {
                if (this.isInitialized) {
                    this.logger.warn('StyleManager', 
                        'Style manager already initialized');
                    return;
                }
                
                this.logger.info('StyleManager', 
                    'Starting style manager initialization');
                
                // Add styles
                const stylesAdded = this.addStyles();
                
                if (!stylesAdded) {
                    this.logger.error('StyleManager', 
                        'Failed to add styles');
                    return;
                }
                
                // Apply classes initially
                this.applyClasses();
                
                // Setup observer for dynamic updates
                this.setupObserver();
                
                this.isInitialized = true;
                
                this.logger.info('StyleManager', 
                    'Style manager initialized successfully');
                
            } catch (error) {
                this.logger.error('StyleManager', 
                    'Error during initialization', error);
                this.isInitialized = false;
            }
        }

        /**
         * Stop style manager and cleanup
         */
        stop() {
            try {
                if (this.observerId) {
                    this.resourceManager.disconnectObserver(this.observerId);
                    this.observerId = null;
                }
                
                this.isInitialized = false;
                
                this.logger.info('StyleManager', 
                    'Style manager stopped');
                
            } catch (error) {
                this.logger.error('StyleManager', 
                    'Error stopping style manager', error);
            }
        }
    }

    //===================================================================================
    // DELETE BUTTON FOCUS MANAGER
    //===================================================================================
    
    /**
     * Automatically focuses the delete button in confirmation modals
     * Enables quick confirmation with Enter key
     */
    class DeleteButtonFocusManager {
        constructor(logger, resourceManager) {
            this.logger = logger;
            this.resourceManager = resourceManager;
            this.config = CONFIG.deleteButton;
            this.observerId = null;
            this.focusIntervalId = null;
            this.isInitialized = false;
            
            this.logger.info('DeleteButtonFocusManager', 
                'Delete button focus manager initialized');
        }

        /**
         * Find and focus the delete button
         * @returns {boolean} Success status
         */
        focusDeleteButton() {
            try {
                const deleteButton = document.querySelector(
                    this.config.selector
                );
                
                if (!deleteButton) {
                    return false;
                }
                
                deleteButton.focus();
                
                this.logger.info('DeleteButtonFocusManager', 
                    'Delete button focused successfully');
                
                return true;
                
            } catch (error) {
                this.logger.error('DeleteButtonFocusManager', 
                    'Error focusing delete button', error);
                return false;
            }
        }

        /**
         * Try to focus delete button with retry mechanism
         */
        tryFocusDeleteButton() {
            try {
                this.logger.debug('DeleteButtonFocusManager', 
                    'Starting delete button focus attempts');
                
                // Clear any existing interval
                if (this.focusIntervalId) {
                    this.resourceManager.clearInterval(this.focusIntervalId);
                    this.focusIntervalId = null;
                }
                
                // Start new interval
                this.focusIntervalId = this.resourceManager.registerInterval(
                    () => {
                        const success = this.focusDeleteButton();
                        
                        if (success && this.focusIntervalId) {
                            this.resourceManager.clearInterval(this.focusIntervalId);
                            this.focusIntervalId = null;
                        }
                    },
                    this.config.focusInterval,
                    'Delete button focus attempts'
                );
                
                // Set timeout to stop trying
                this.resourceManager.registerTimeout(
                    () => {
                        if (this.focusIntervalId) {
                            this.logger.debug('DeleteButtonFocusManager', 
                                'Focus timeout reached, stopping attempts');
                            
                            this.resourceManager.clearInterval(this.focusIntervalId);
                            this.focusIntervalId = null;
                        }
                    },
                    this.config.timeout,
                    'Delete button focus timeout'
                );
                
            } catch (error) {
                this.logger.error('DeleteButtonFocusManager', 
                    'Error trying to focus delete button', error);
            }
        }

        /**
         * Setup MutationObserver to detect modal appearance
         */
        setupObserver() {
            try {
                this.logger.info('DeleteButtonFocusManager', 
                    'Setting up modal detection observer');
                
                const observer = new MutationObserver((mutations) => {
                    try {
                        for (const mutation of mutations) {
                            if (mutation.addedNodes.length === 0) {
                                continue;
                            }
                            
                            for (const node of mutation.addedNodes) {
                                if (node.nodeType !== 1) {
                                    continue;
                                }
                                
                                // Check if node contains delete button
                                const hasDeleteButton = node.querySelector(
                                    this.config.selector
                                );
                                
                                if (hasDeleteButton) {
                                    this.logger.info('DeleteButtonFocusManager', 
                                        'Delete modal detected');
                                    this.tryFocusDeleteButton();
                                    break;
                                }
                            }
                        }
                    } catch (error) {
                        this.logger.error('DeleteButtonFocusManager', 
                            'Error in mutation observer callback', error);
                    }
                });
                
                observer.observe(document.body, { 
                    childList: true, 
                    subtree: true 
                });
                
                this.observerId = this.resourceManager.registerObserver(
                    observer,
                    'Delete button modal observer'
                );
                
                this.logger.info('DeleteButtonFocusManager', 
                    'Modal detection observer set up successfully');
                
            } catch (error) {
                this.logger.error('DeleteButtonFocusManager', 
                    'Error setting up observer', error);
            }
        }

        /**
         * Initialize delete button focus manager
         */
        initialize() {
            try {
                if (this.isInitialized) {
                    this.logger.warn('DeleteButtonFocusManager', 
                        'Delete button focus manager already initialized');
                    return;
                }
                
                this.logger.info('DeleteButtonFocusManager', 
                    'Starting delete button focus manager');
                
                this.setupObserver();
                
                this.isInitialized = true;
                
                this.logger.info('DeleteButtonFocusManager', 
                    'Delete button focus manager initialized successfully');
                
            } catch (error) {
                this.logger.error('DeleteButtonFocusManager', 
                    'Error during initialization', error);
                this.isInitialized = false;
            }
        }

        /**
         * Stop delete button focus manager
         */
        stop() {
            try {
                if (this.observerId) {
                    this.resourceManager.disconnectObserver(this.observerId);
                    this.observerId = null;
                }
                
                if (this.focusIntervalId) {
                    this.resourceManager.clearInterval(this.focusIntervalId);
                    this.focusIntervalId = null;
                }
                
                this.isInitialized = false;
                
                this.logger.info('DeleteButtonFocusManager', 
                    'Delete button focus manager stopped');
                
            } catch (error) {
                this.logger.error('DeleteButtonFocusManager', 
                    'Error stopping delete button focus manager', error);
            }
        }
    }

    //===================================================================================
    // APPLICATION MANAGER
    //===================================================================================
    
    /**
     * Main application manager that coordinates all modules
     * Handles initialization, lifecycle, and error recovery
     */
    class ApplicationManager {
        constructor() {
            this.logger = new Logger(CONFIG.logging);
            this.resourceManager = new ResourceManager(this.logger);
            
            this.modules = {
                sortManager: null,
                formAutoFiller: null,
                contentSizeMonitor: null,
                styleManager: null,
                deleteButtonFocusManager: null
            };
            
            this.isInitialized = false;
            
            this.logger.info('ApplicationManager', 
                '='.repeat(80));
            this.logger.info('ApplicationManager', 
                'Meiro Better Workflow - Production Ready Version');
            this.logger.info('ApplicationManager', 
                '='.repeat(80));
        }

        /**
         * Initialize all modules
         */
        async initializeModules() {
            try {
                this.logger.info('ApplicationManager', 
                    'Starting module initialization');
                
                const startTime = Date.now();
                
                // Initialize Sort Manager
                try {
                    this.modules.sortManager = new SortManager(
                        this.logger, 
                        this.resourceManager
                    );
                    this.modules.sortManager.initialize();
                } catch (error) {
                    this.logger.error('ApplicationManager', 
                        'Failed to initialize Sort Manager', error);
                }
                
                // Initialize Form Auto-Filler
                try {
                    this.modules.formAutoFiller = new FormAutoFiller(
                        this.logger, 
                        this.resourceManager
                    );
                    await this.modules.formAutoFiller.initialize();
                } catch (error) {
                    this.logger.error('ApplicationManager', 
                        'Failed to initialize Form Auto-Filler', error);
                }
                
                // Initialize Content Size Monitor
                try {
                    this.modules.contentSizeMonitor = new ContentSizeMonitor(
                        this.logger, 
                        this.resourceManager
                    );
                    this.modules.contentSizeMonitor.initialize();
                } catch (error) {
                    this.logger.error('ApplicationManager', 
                        'Failed to initialize Content Size Monitor', error);
                }
                
                // Initialize Style Manager
                try {
                    this.modules.styleManager = new StyleManager(
                        this.logger, 
                        this.resourceManager
                    );
                    this.modules.styleManager.initialize();
                } catch (error) {
                    this.logger.error('ApplicationManager', 
                        'Failed to initialize Style Manager', error);
                }
                
                // Initialize Delete Button Focus Manager
                try {
                    this.modules.deleteButtonFocusManager = new DeleteButtonFocusManager(
                        this.logger, 
                        this.resourceManager
                    );
                    this.modules.deleteButtonFocusManager.initialize();
                } catch (error) {
                    this.logger.error('ApplicationManager', 
                        'Failed to initialize Delete Button Focus Manager', error);
                }
                
                const duration = Date.now() - startTime;
                
                this.logger.info('ApplicationManager', 
                    `All modules initialized in ${duration}ms`);
                
                this.logResourceStats();
                
            } catch (error) {
                this.logger.error('ApplicationManager', 
                    'Critical error during module initialization', error);
            }
        }

        /**
         * Log current resource statistics
         */
        logResourceStats() {
            try {
                const stats = this.resourceManager.getStats();
                this.logger.info('ApplicationManager', 
                    `Resource stats - Intervals: ${stats.intervals}, ` +
                    `Timeouts: ${stats.timeouts}, ` +
                    `Observers: ${stats.observers}, ` +
                    `Total: ${stats.total}`
                );
            } catch (error) {
                this.logger.error('ApplicationManager', 
                    'Error logging resource stats', error);
            }
        }

        /**
         * Wait for DOM to be ready
         * @returns {Promise} Promise that resolves when DOM is ready
         */
        waitForDOMReady() {
            return new Promise((resolve) => {
                if (document.readyState === 'loading') {
                    this.logger.info('ApplicationManager', 
                        'Waiting for DOM to be ready');
                    
                    document.addEventListener('DOMContentLoaded', () => {
                        this.logger.info('ApplicationManager', 
                            'DOM ready event detected');
                        resolve();
                    });
                } else {
                    this.logger.info('ApplicationManager', 
                        'DOM already ready');
                    resolve();
                }
            });
        }

        /**
         * Initialize the application
         */
        async initialize() {
            try {
                if (this.isInitialized) {
                    this.logger.warn('ApplicationManager', 
                        'Application already initialized');
                    return;
                }
                
                this.logger.info('ApplicationManager', 
                    'Starting application initialization');
                
                // Wait for DOM
                await this.waitForDOMReady();
                
                // Initialize all modules
                await this.initializeModules();
                
                this.isInitialized = true;
                
                this.logger.info('ApplicationManager', 
                    '='.repeat(80));
                this.logger.info('ApplicationManager', 
                    'Application initialized successfully');
                this.logger.info('ApplicationManager', 
                    '='.repeat(80));
                
            } catch (error) {
                this.logger.error('ApplicationManager', 
                    'Critical error during application initialization', error);
            }
        }

        /**
         * Shutdown the application and cleanup resources
         */
        shutdown() {
            try {
                this.logger.info('ApplicationManager', 
                    'Starting application shutdown');
                
                // Stop all modules
                for (const [name, module] of Object.entries(this.modules)) {
                    if (module && typeof module.stop === 'function') {
                        try {
                            module.stop();
                        } catch (error) {
                            this.logger.error('ApplicationManager', 
                                `Error stopping module: ${name}`, error);
                        }
                    }
                }
                
                // Cleanup all resources
                this.resourceManager.cleanupAll();
                
                this.isInitialized = false;
                
                this.logger.info('ApplicationManager', 
                    'Application shutdown completed');
                
            } catch (error) {
                this.logger.error('ApplicationManager', 
                    'Error during application shutdown', error);
            }
        }
    }

    //===================================================================================
    // APPLICATION STARTUP
    //===================================================================================
    
    try {
        // Create and initialize application
        const app = new ApplicationManager();
        
        // Initialize application
        app.initialize().catch(error => {
            console.error('Fatal error during application startup:', error);
        });
        
        // Expose app instance globally for debugging
        window.MeiroBetterWorkflow = {
            app: app,
            version: '2025-09-29',
            config: CONFIG
        };
        
    } catch (error) {
        console.error('Fatal error creating application:', error);
    }

})();
