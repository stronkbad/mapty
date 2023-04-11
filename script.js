'use strict';

class Workout {
  date = new Date();
  clicks = 0;

  constructor(coords, distance, duration, created, id, line) {
    this.created = created;
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
    this.id = id;
    this.line = line;
  }
  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'Decemeber'];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence, created, id, line) {
    super(coords, distance, duration, created, id, line);
    this.cadence = cadence;
    this._setDescription();
    this.calcPace();
  }
  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace; // min/km
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain, created, id, line) {
    super(coords, distance, duration, created, id, line);
    this.elevationGain = elevationGain;
    this._setDescription();
    this.calcSpeed();
  }
  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed; // km/h
  }
}

////////////////////////////////////////////
//APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const mapContainer = document.querySelector('#map');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const delBtn = document.querySelector('.delete__btn');
const delAll = document.querySelector('.deleteAll__btn');
const overlay = document.querySelector('.overlay');
const modal = document.querySelector('.modal');
const sortMenu = document.querySelector('.sort__menu');
const sortDistance = document.querySelector('.sort--distance');
const sortDuration = document.querySelector('.sort--duration');
const sortPaceSpeed = document.querySelector('.sort--paceSpeed');
const sortCadence = document.querySelector('.sort--cadence');
const sortElevation = document.querySelector('.sort--elevation');

class App {
  #map;
  #mapEvent;
  #workouts = [];
  #mapZoomLevel = 14;
  #targetWorkout;
  #markers = [];
  #line;
  #center;
  #polylines = [];
  #drawnLines = new L.FeatureGroup();
  #renderLines = new L.FeatureGroup();

  constructor() {
    this._getPosition();
    this._getLocalStorage();
    this._modalMessage();
    //attach event handlers
    // mapContainer.addEventListener(
    //   'mouseover',
    //   this._removeDrawnLines.bind(this)
    // );
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    delBtn.addEventListener('click', this._deleteWorkout.bind(this));
    delAll.addEventListener('click', this._DeleteAllWorkouts);
    sortDistance.addEventListener('click', () =>
      this._sortWorkouts(this.#workouts, 'distance')
    );
    sortDuration.addEventListener('click', () =>
      this._sortWorkouts(this.#workouts, 'duration')
    );
    sortPaceSpeed.addEventListener('click', () =>
      this._sortWorkouts(
        this.#workouts,
        this.type === 'running' ? 'pace' : 'speed'
      )
    );

    sortCadence.addEventListener('click', () =>
      this._sortWorkouts(this.#workouts, 'cadence')
    );
    sortElevation.addEventListener('click', () =>
      this._sortWorkouts(this.#workouts, 'elevationGain')
    );
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);
    const drawControl = new L.Control.Draw({
      draw: {
        polyline: true, // enable drawing polylines
        polygon: true,
        circle: false,
        marker: false,
        rectangle: true,
      },
      edit: false,
    });
    this.#map.addControl(drawControl);
    // this.#map.clearLayer(this.#drawnLines);
    //handling clicks on map;
    this.#map.on('click', this._mapClick.bind(this));
    // when a polyline is created, add it to the drawnItems layer and save its coordinates
    this.#map.on('draw:created', e => {
      const layer = e.layer;
      const latLngs = layer.getLatLngs();

      const drawLine = L.polyline(latLngs, {
        color: 'red',
        weight: 3,
      })
        // .addTo(this.#drawnLines)
        .addTo(this.#map);
      console.log(this.#drawnLines);
      console.log(this.#map);
      this._showForm();
      this.#line = latLngs;

      this.#renderLines.addLayer(drawLine);

      const bounds = drawLine.getBounds();
      const center = bounds.getCenter();
      this.#center = center;
    });
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
      this._renderPolyline(work);
      //render polylines too here
    });
  }

  _mapClick(mapE) {
    this.#mapEvent = mapE;
    this._hideDeleteButton();
    this._hideForm();
    this.#targetWorkout = '';
    this.workout = '';
    inputType.disabled = false;
    this._;
    console.log(this.#targetWorkout);
    return;
  }

  _removeDrawnLines() {
    console.log(this);
    console.log(this.#map);
    if (!this.#drawnLines) return;
    this.#map.e.removeLayer(this.#drawnLines);
  }

  _modalMessage() {
    if (this.#workouts.length > 0) modal.textContent = 'Welcome back!';
    else modal.textContent = 'Click on the map to get started!';
    this._closeModal();
  }

  _closeModal() {
    overlay.addEventListener('click', function () {
      overlay.style.display = 'none';
      modal.style.display = 'none';
    });
    modal.addEventListener('click', function (event) {
      overlay.style.display = 'none';
      modal.style.display = 'none';
      event.stopPropagation();
    });
  }

  _formErrorMsg() {
    modal.textContent = 'Inputs have to be positive numbers!';
    overlay.style.display = '';
    modal.style.display = '';
    this._closeModal();
  }

  _showForm(mapE) {
    // this._mapClick(mapE);
    form.classList.remove('hidden');
    this._emptyForm();
    inputDistance.focus();
  }

  _fillForm(workout) {
    inputType.value = workout.type;
    inputType.disabled = true;
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;

    if (workout.type === 'running') {
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
      inputCadence.value = workout.cadence;
    } else if (workout.type === 'cycling') {
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      inputElevation.value = workout.elevationGain;
    }
  }

  _emptyForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
  }

  _hideForm() {
    this._emptyForm();
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);
    e.preventDefault();
    //get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    if (!this.#mapEvent) this._editWorkout();
    if (!this.#center) return;
    const { lat, lng } = this.#center;

    let workout;
    let created = new Date();
    const id = (Date.now() + '').slice(-10);
    let line = this.#line;
    //if workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return this._formErrorMsg();
      workout = new Running(
        [lat, lng],
        distance,
        duration,
        cadence,
        created,
        id,
        line
      );
    }
    //if workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return this._formErrorMsg();
      workout = new Cycling(
        [lat, lng],
        distance,
        duration,
        elevation,
        created,
        id,
        line
      );
    }

    this.#workouts.push(workout);
    this._showSortMenu();
    //render polyline too here
    this._renderPolyline(workout);
    this._renderWorkoutMarker(workout);

    this._renderWorkout(workout);
    this._hideForm();
    this._setLocalStorage();
  }

  _sortWorkouts(workouts, key) {
    this._hideForm();
    this._hideDeleteButton();

    workouts.sort((a, b) => {
      if (a[key] === undefined || a[key] === null) {
        return -1;
      } else if (b[key] === undefined || b[key] === null) {
        return 1;
      } else {
        return a[key] - b[key];
      }
    });

    const workoutElements = document.querySelectorAll('.workout');
    workoutElements.forEach(workoutElement => {
      if (containerWorkouts.contains(workoutElement)) {
        containerWorkouts.removeChild(workoutElement);
      }
    });

    workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  _showSortMenu() {
    if (this.#workouts.length > 1) sortMenu.classList.remove('hidesort');
  }
  _hideSortMenu() {
    if (this.#workouts.length <= 1) sortMenu.classList.add('hidesort');
  }

  _showDeleteButton() {
    delBtn.classList.remove('hide');
    ('hide');
  }
  _hideDeleteButton() {
    delBtn.classList.add('hide');
  }
  _showDeleteAll() {
    delAll.classList.remove('hide');
  }
  _hideDeleteAll() {
    delAll.classList.add('hide');
  }

  _editWorkout(workout) {
    workout = this.#targetWorkout;

    const originalDistance = workout.distance;
    const originalDuration = workout.duration;
    const originalCadence = workout.cadence;
    const originalElevation = workout.elevationGain;

    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);
    workout.type = inputType.value;
    workout.distance = +inputDistance.value;
    workout.duration = +inputDuration.value;
    if (workout.type === 'running') {
      workout.cadence = +inputCadence.value;
      if (
        !validInputs(workout.distance, workout.duration, workout.cadence) ||
        !allPositive(workout.distance, workout.duration, workout.cadence)
      ) {
        workout.distance = originalDistance;
        workout.duration = originalDuration;
        workout.cadence = originalCadence;
        this._formErrorMsg();
      }
    }
    if (workout.type === 'cycling') {
      workout.elevationGain = +inputElevation.value;
      if (
        !validInputs(
          workout.distance,
          workout.duration,
          workout.elevationGain
        ) ||
        !allPositive(workout.distance, workout.duration)
      ) {
        workout.distance = originalDistance;
        workout.duration = originalDuration;
        workout.elevationGain = originalElevation;
        this._formErrorMsg();
      }
    }
    this._setLocalStorage();
    const updateElWorkout = document.querySelector(`[data-id="${workout.id}"]`);
    console.log(updateElWorkout);
    updateElWorkout.remove();
    this._hideForm();
    this._hideDeleteButton();
    this._renderWorkout(workout);
    if (this.#workouts.length <= 1) this._hideDeleteAll();
  }

  _deleteWorkout() {
    // Find the workout with the matching id and remove it from the workouts array
    console.log(this.#targetWorkout);
    const updatedWorkouts = this.#workouts.filter(
      workout => workout.id !== this.#targetWorkout.id
    );
    // Render the updated workouts array
    this.#workouts = updatedWorkouts;

    const deletedWorkoutElement = document.querySelector(
      `[data-id="${this.#targetWorkout.id}"]`
    );
    console.log(deletedWorkoutElement);
    deletedWorkoutElement.remove();
    const marker = this.#markers.find(
      marker => marker._id === this.#targetWorkout.id
    );
    marker.removeFrom(this.#map);
    const polyline = this.#polylines.find(
      polyline => polyline._id === this.#targetWorkout.id
    );
    if (polyline) {
      this.#map.removeLayer(polyline);
      this.#renderLines.removeLayer(polyline);
      this.#polylines = this.#polylines.filter(p => p !== polyline);
    }

    localStorage.setItem('workouts', JSON.stringify(updatedWorkouts));
    this._hideSortMenu();
    this._hideDeleteButton();
    if (this.#workouts.length <= 2) this._hideDeleteAll();
    this._hideForm();
  }

  _DeleteAllWorkouts() {
    alert('Are you sure you want to delete all workouts?');
    localStorage.removeItem('workouts');
    location.reload();
  }

  _renderPolyline(workout) {
    if (!workout.line) return;
    const color = workout.type === 'running' ? '#00c46a' : '#ffb545';
    const polyline = L.polyline(workout.line, { color: color }).addTo(
      this.#map
    );
    // // this.#map.addLayer(drawnItems);
    // polyline._id = workout.id; // assign the workout ID to the polyline
    polyline._id = workout.id;
    this.#polylines.push(polyline);
    this.#renderLines.addLayer(polyline);
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
    marker._id = workout.id; // assign the workout ID to the marker
    this.#markers.push(marker);
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <h2 class="workout__title">${workout.description}</h2>
      <div class="workout__details">
        <span class="workout__icon">${
          workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
        }</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>
      `;
    if (workout.type === 'running')
      html += `
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.pace.toFixed(1)}</span>
        <span class="workout__unit">min/km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">🦶🏼</span>
        <span class="workout__value">${workout.cadence}</span>
        <span class="workout__unit">spm</span>
      </div>
    </li>
    `;
    if (workout.type === 'cycling')
      html += `
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.speed.toFixed(1)}</span>
        <span class="workout__unit">km/h</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⛰</span>
        <span class="workout__value">${workout.elevationGain}</span>
        <span class="workout__unit">m</span>
      </div>
    </li>
    `;
    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    let workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;
    let workout = this.#workouts.find(work => work.id === workoutEl.dataset.id);
    this.#targetWorkout = workout;

    // if (Worker.marker.getPopup().isOpen()) return;
    // this.#map.closePopup();
    // workout.marker.openPopup();

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
    console.log(workout);
    //using the public interface
    workout.click();
    this._showForm();
    this._fillForm(workout);
    if (this.#workouts.length >= 1) this._showDeleteButton();
    if (this.#workouts.length >= 2) this._showDeleteAll();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;
    //maps the data to the workout class
    this.#workouts = data.map(work => {
      const {
        type,
        coords,
        distance,
        duration,
        cadence,
        elevationGain,
        created,
        id,
        line,
      } = work;
      //  return type of workout
      if (type === 'running') {
        return new Running(
          coords,
          distance,
          duration,
          cadence,
          created,
          id,
          line
        );
      } else {
        return new Cycling(
          coords,
          distance,
          duration,
          elevationGain,
          created,
          id,
          line
        );
      }
    });
    //renders the workouts
    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
    this._showSortMenu();
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
