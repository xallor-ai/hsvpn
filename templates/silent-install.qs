function Controller() {
    installer.autoRejectMessageBoxes();
    installer.setMessageBoxAutomaticAnswer("OverwriteTargetDirectory", QMessageBox.Yes);
    installer.setMessageBoxAutomaticAnswer("stopProcessesForUpdates", QMessageBox.Ignore);
    installer.setMessageBoxAutomaticAnswer("os.warning", QMessageBox.Ok);
    installer.installationFinished.connect(function() {
        gui.clickButton(buttons.NextButton);
    });
}
Controller.prototype.WelcomePageCallback = function() {
    gui.clickButton(buttons.NextButton, 3000);
}
Controller.prototype.IntroductionPageCallback = function() {
    gui.clickButton(buttons.NextButton, 3000);
}
Controller.prototype.TargetDirectoryPageCallback = function() {
    var widget = gui.currentPageWidget();
    if (widget != null) {
        widget.TargetDirectoryLineEdit.setText("/opt/HillstoneSecureConnect");
    }
    gui.clickButton(buttons.NextButton, 3000);
}
Controller.prototype.ComponentSelectionPageCallback = function() {
    gui.clickButton(buttons.NextButton, 3000);
}
Controller.prototype.LicenseAgreementPageCallback = function() {
    var widget = gui.currentPageWidget();
    if (widget != null) {
        widget.AcceptLicenseRadioButton.setChecked(true);
    }
    gui.clickButton(buttons.NextButton, 3000);
}
Controller.prototype.StartMenuDirectoryPageCallback = function() {
    gui.clickButton(buttons.NextButton, 3000);
}
Controller.prototype.ReadyForInstallationPageCallback = function() {
    gui.clickButton(buttons.NextButton, 3000);
}
Controller.prototype.PerformInstallationPageCallback = function() {
    gui.clickButton(buttons.NextButton, 3000);
}
Controller.prototype.FinishedPageCallback = function() {
    gui.clickButton(buttons.FinishButton, 3000);
}