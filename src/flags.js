const CALIBRATION_FLAGS = new Set(['--calibrate', '--debug-positioning']);

function isCalibrationEnabled(argv = []) {
  return argv.some((argument) => CALIBRATION_FLAGS.has(argument));
}

module.exports = {
  CALIBRATION_FLAGS,
  isCalibrationEnabled
};
